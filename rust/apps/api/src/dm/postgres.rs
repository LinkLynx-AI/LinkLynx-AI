use std::sync::atomic::{AtomicU64, Ordering};

use tokio::sync::RwLock;
use tokio_postgres::{NoTls, Row};

/// Postgres-backed DM service を表現する。
#[derive(Clone)]
pub struct PostgresDmService {
    database_url: Arc<str>,
    allow_postgres_notls: bool,
    message_service: Arc<dyn MessageService>,
    clients: Arc<RwLock<Vec<Arc<tokio_postgres::Client>>>>,
    next_index: Arc<AtomicU64>,
    pool_size: usize,
}

impl PostgresDmService {
    const DEFAULT_POOL_SIZE: usize = 4;
    const MAX_POOL_SIZE: usize = 100;
    const LIST_DM_CHANNELS_SQL: &str = "
        SELECT
          c.id AS channel_id,
          to_char(c.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS created_at,
          clm.last_message_id,
          recipient.id AS recipient_user_id,
          recipient.display_name AS recipient_display_name,
          recipient.avatar_key AS recipient_avatar_key
        FROM dm_participants self_participant
        JOIN channels c
          ON c.id = self_participant.channel_id
         AND c.type = 'dm'
        JOIN dm_participants other_participant
          ON other_participant.channel_id = c.id
         AND other_participant.user_id <> self_participant.user_id
        JOIN users recipient
          ON recipient.id = other_participant.user_id
        LEFT JOIN channel_last_message clm
          ON clm.channel_id = c.id
        WHERE self_participant.user_id = $1
        ORDER BY COALESCE(clm.last_message_at, c.created_at) DESC, c.id DESC";
    const GET_DM_CHANNEL_SQL: &str = "
        SELECT
          c.id AS channel_id,
          to_char(c.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS created_at,
          clm.last_message_id,
          recipient.id AS recipient_user_id,
          recipient.display_name AS recipient_display_name,
          recipient.avatar_key AS recipient_avatar_key
        FROM dm_participants self_participant
        JOIN channels c
          ON c.id = self_participant.channel_id
         AND c.type = 'dm'
        JOIN dm_participants other_participant
          ON other_participant.channel_id = c.id
         AND other_participant.user_id <> self_participant.user_id
        JOIN users recipient
          ON recipient.id = other_participant.user_id
        LEFT JOIN channel_last_message clm
          ON clm.channel_id = c.id
        WHERE self_participant.user_id = $1
          AND c.id = $2
        LIMIT 1";
    const OPEN_OR_CREATE_DM_SQL: &str = "
        WITH locked AS (
          SELECT
            pg_advisory_xact_lock(LEAST($1::bigint, $2::bigint)) AS low_lock,
            pg_advisory_xact_lock(GREATEST($1::bigint, $2::bigint)) AS high_lock
        ),
        normalized AS (
          SELECT
            LEAST($1::bigint, $2::bigint) AS user_low,
            GREATEST($1::bigint, $2::bigint) AS user_high
          FROM locked
        ),
        existing AS (
          SELECT dp.channel_id
          FROM normalized n
          JOIN dm_pairs dp
            ON dp.user_low = n.user_low
           AND dp.user_high = n.user_high
        ),
        created_channel AS (
          INSERT INTO channels (type, created_by)
          SELECT
            'dm',
            $1
          WHERE NOT EXISTS (SELECT 1 FROM existing)
          RETURNING id
        ),
        inserted_pair AS (
          INSERT INTO dm_pairs (user_low, user_high, channel_id)
          SELECT n.user_low, n.user_high, c.id
          FROM normalized n
          JOIN created_channel c ON TRUE
          ON CONFLICT (user_low, user_high) DO NOTHING
          RETURNING channel_id
        ),
        chosen AS (
          SELECT channel_id FROM existing
          UNION ALL
          SELECT channel_id FROM inserted_pair
          UNION ALL
          SELECT dp.channel_id
          FROM normalized n
          JOIN dm_pairs dp
            ON dp.user_low = n.user_low
           AND dp.user_high = n.user_high
          LIMIT 1
        ),
        participants AS (
          INSERT INTO dm_participants (channel_id, user_id)
          SELECT c.channel_id, participant.user_id
          FROM chosen c
          CROSS JOIN (VALUES ($1::bigint), ($2::bigint)) AS participant(user_id)
          ON CONFLICT (channel_id, user_id) DO NOTHING
        )
        SELECT channel_id FROM chosen LIMIT 1";

    /// Postgres DM service を生成する。
    /// @param database_url 接続文字列
    /// @param allow_postgres_notls 平文接続許可
    /// @param message_service message service
    /// @returns DM service
    /// @throws なし
    pub fn new(
        database_url: String,
        allow_postgres_notls: bool,
        message_service: Arc<dyn MessageService>,
    ) -> Self {
        Self {
            database_url: Arc::from(database_url),
            allow_postgres_notls,
            message_service,
            clients: Arc::new(RwLock::new(Vec::new())),
            next_index: Arc::new(AtomicU64::new(0)),
            pool_size: Self::DEFAULT_POOL_SIZE,
        }
    }

    async fn connect_client(&self) -> Result<Arc<tokio_postgres::Client>, DmError> {
        if !self.allow_postgres_notls {
            return Err(DmError::dependency_unavailable("postgres_tls_required"));
        }
        let (client, connection) = tokio_postgres::connect(self.database_url.as_ref(), NoTls)
            .await
            .map_err(|error| DmError::dependency_unavailable(format!("dm_connect_failed:{error}")))?;
        tokio::spawn(async move {
            if let Err(error) = connection.await {
                tracing::error!(reason = %error, "dm postgres connection error");
            }
        });
        Ok(Arc::new(client))
    }

    async fn ensure_pool(&self) -> Result<(), DmError> {
        {
            let guard = self.clients.read().await;
            if !guard.is_empty() {
                return Ok(());
            }
        }
        let mut guard = self.clients.write().await;
        if !guard.is_empty() {
            return Ok(());
        }
        for _ in 0..self.pool_size.min(Self::MAX_POOL_SIZE) {
            guard.push(self.connect_client().await?);
        }
        Ok(())
    }

    async fn select_client(&self) -> Result<Arc<tokio_postgres::Client>, DmError> {
        self.ensure_pool().await?;
        let guard = self.clients.read().await;
        if guard.is_empty() {
            return Err(DmError::dependency_unavailable("dm_pool_empty"));
        }
        let index = (self.next_index.fetch_add(1, Ordering::Relaxed) as usize) % guard.len();
        Ok(Arc::clone(&guard[index]))
    }

    fn validate_recipient_id(&self, principal_id: PrincipalId, recipient_id: i64) -> Result<(), DmError> {
        if recipient_id <= 0 {
            return Err(DmError::validation("recipient_id_invalid"));
        }
        if principal_id.0 == recipient_id {
            return Err(DmError::validation("dm_self_target_not_allowed"));
        }
        Ok(())
    }

    fn map_channel_row(&self, row: Row) -> Result<DmChannelSummary, DmError> {
        Ok(DmChannelSummary {
            channel_id: row
                .try_get("channel_id")
                .map_err(|error| DmError::dependency_unavailable(format!("dm_channel_id_decode_failed:{error}")))?,
            created_at: row
                .try_get("created_at")
                .map_err(|error| DmError::dependency_unavailable(format!("dm_created_at_decode_failed:{error}")))?,
            last_message_id: row
                .try_get("last_message_id")
                .map_err(|error| DmError::dependency_unavailable(format!("dm_last_message_id_decode_failed:{error}")))?,
            recipient: DmRecipientSummary {
                user_id: row
                    .try_get("recipient_user_id")
                    .map_err(|error| DmError::dependency_unavailable(format!("dm_recipient_id_decode_failed:{error}")))?,
                display_name: row
                    .try_get("recipient_display_name")
                    .map_err(|error| DmError::dependency_unavailable(format!("dm_recipient_display_name_decode_failed:{error}")))?,
                avatar_key: row
                    .try_get("recipient_avatar_key")
                    .map_err(|error| DmError::dependency_unavailable(format!("dm_recipient_avatar_decode_failed:{error}")))?,
            },
        })
    }

    async fn ensure_participant(
        &self,
        client: &tokio_postgres::Client,
        principal_id: PrincipalId,
        channel_id: i64,
    ) -> Result<(), DmError> {
        let row = client
            .query_opt(
                "SELECT 1
                 FROM dm_participants dp
                 JOIN channels c ON c.id = dp.channel_id
                 WHERE dp.channel_id = $1
                   AND dp.user_id = $2
                   AND c.type = 'dm'
                 LIMIT 1",
                &[&channel_id, &principal_id.0],
            )
            .await
            .map_err(|error| DmError::dependency_unavailable(format!("dm_participant_lookup_failed:{error}")))?;
        if row.is_some() {
            return Ok(());
        }
        let exists = client
            .query_opt(
                "SELECT 1 FROM channels WHERE id = $1 AND type = 'dm' LIMIT 1",
                &[&channel_id],
            )
            .await
            .map_err(|error| DmError::dependency_unavailable(format!("dm_channel_lookup_failed:{error}")))?;
        if exists.is_some() {
            return Err(DmError::forbidden("dm_participant_required"));
        }
        Err(DmError::not_found("dm_channel_not_found"))
    }
}

#[async_trait]
impl DmService for PostgresDmService {
    async fn list_dm_channels(
        &self,
        principal_id: PrincipalId,
    ) -> Result<Vec<DmChannelSummary>, DmError> {
        let client = self.select_client().await?;
        let rows = client
            .query(Self::LIST_DM_CHANNELS_SQL, &[&principal_id.0])
            .await
            .map_err(|error| DmError::dependency_unavailable(format!("dm_list_query_failed:{error}")))?;
        rows.into_iter().map(|row| self.map_channel_row(row)).collect()
    }

    async fn get_dm_channel(
        &self,
        principal_id: PrincipalId,
        channel_id: i64,
    ) -> Result<DmChannelSummary, DmError> {
        let client = self.select_client().await?;
        let row = client
            .query_opt(Self::GET_DM_CHANNEL_SQL, &[&principal_id.0, &channel_id])
            .await
            .map_err(|error| DmError::dependency_unavailable(format!("dm_get_query_failed:{error}")))?;
        match row {
            Some(row) => self.map_channel_row(row),
            None => {
                self.ensure_participant(&client, principal_id, channel_id).await?;
                Err(DmError::not_found("dm_channel_not_found"))
            }
        }
    }

    async fn open_or_create_dm(
        &self,
        principal_id: PrincipalId,
        recipient_id: i64,
    ) -> Result<DmChannelSummary, DmError> {
        self.validate_recipient_id(principal_id, recipient_id)?;
        let client = self.select_client().await?;
        let recipient_exists = client
            .query_opt(
                "SELECT 1 FROM users WHERE id = $1 LIMIT 1",
                &[&recipient_id],
            )
            .await
            .map_err(|error| {
                DmError::dependency_unavailable(format!("dm_recipient_lookup_failed:{error}"))
            })?;
        if recipient_exists.is_none() {
            return Err(DmError::not_found("recipient_not_found"));
        }
        let row = client
            .query_one(Self::OPEN_OR_CREATE_DM_SQL, &[&principal_id.0, &recipient_id])
            .await
            .map_err(|error| {
                DmError::dependency_unavailable(format!("dm_open_or_create_failed:{error}"))
            })?;
        let channel_id = row
            .try_get::<_, i64>("channel_id")
            .map_err(|error| DmError::dependency_unavailable(format!("dm_channel_id_decode_failed:{error}")))?;
        self.get_dm_channel(principal_id, channel_id).await
    }

    async fn list_dm_messages(
        &self,
        principal_id: PrincipalId,
        channel_id: i64,
        query: ListGuildChannelMessagesQueryV1,
    ) -> Result<ListGuildChannelMessagesResponseV1, DmError> {
        let client = self.select_client().await?;
        self.ensure_participant(&client, principal_id, channel_id).await?;
        self.message_service
            .list_dm_channel_messages(channel_id, query)
            .await
            .map_err(|error| match error.kind {
                crate::message::MessageErrorKind::Validation => DmError::validation(error.reason),
                crate::message::MessageErrorKind::ChannelNotFound
                | crate::message::MessageErrorKind::MessageNotFound => {
                    DmError::not_found(error.reason)
                }
                crate::message::MessageErrorKind::AuthzDenied => DmError::forbidden(error.reason),
                crate::message::MessageErrorKind::Conflict => DmError::validation(error.reason),
                crate::message::MessageErrorKind::DependencyUnavailable => {
                    DmError::dependency_unavailable(error.reason)
                }
            })
    }

    async fn create_dm_message(
        &self,
        principal_id: PrincipalId,
        channel_id: i64,
        idempotency_key: Option<&str>,
        request: CreateGuildChannelMessageRequestV1,
    ) -> Result<CreateGuildChannelMessageExecution, DmError> {
        let client = self.select_client().await?;
        self.ensure_participant(&client, principal_id, channel_id).await?;
        self.message_service
            .create_dm_channel_message(principal_id, channel_id, idempotency_key, request)
            .await
            .map_err(|error| match error.kind {
                crate::message::MessageErrorKind::Validation => DmError::validation(error.reason),
                crate::message::MessageErrorKind::ChannelNotFound
                | crate::message::MessageErrorKind::MessageNotFound => {
                    DmError::not_found(error.reason)
                }
                crate::message::MessageErrorKind::AuthzDenied => DmError::forbidden(error.reason),
                crate::message::MessageErrorKind::Conflict => DmError::validation(error.reason),
                crate::message::MessageErrorKind::DependencyUnavailable => {
                    DmError::dependency_unavailable(error.reason)
                }
            })
    }
}
