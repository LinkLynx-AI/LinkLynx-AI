use std::{
    env,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    },
};

use async_trait::async_trait;
use linklynx_message_domain::{
    GuildChannelContext, MessageMetadataRepository, MessageUsecaseError,
};
use tokio::sync::RwLock;
use tokio_postgres::{NoTls, Row};
use tracing::warn;

const SELECT_CHANNEL_CONTEXT_SQL: &str = "
    SELECT
      c.id AS channel_id,
      c.guild_id,
      to_char(c.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS created_at,
      clm.last_message_id,
      CASE
        WHEN clm.last_message_at IS NULL THEN NULL
        ELSE to_char(clm.last_message_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"')
      END AS last_message_at
    FROM channels c
    LEFT JOIN channel_last_message clm
      ON clm.channel_id = c.id
    WHERE c.id = $1
      AND c.type = 'guild_text'";
const UPSERT_LAST_MESSAGE_SQL: &str = "
    INSERT INTO channel_last_message (channel_id, last_message_id, last_message_at)
    VALUES ($1, $2, $3::timestamptz)
    ON CONFLICT (channel_id)
    DO UPDATE SET
      last_message_id = EXCLUDED.last_message_id,
      last_message_at = EXCLUDED.last_message_at,
      updated_at = now()
    WHERE channel_last_message.last_message_at < EXCLUDED.last_message_at
       OR (
         channel_last_message.last_message_at = EXCLUDED.last_message_at
         AND channel_last_message.last_message_id < EXCLUDED.last_message_id
       )";

/// Postgres-backed message metadata repository を表現する。
#[derive(Clone)]
pub struct PostgresMessageMetadataRepository {
    database_url: Arc<str>,
    allow_postgres_notls: bool,
    clients: Arc<RwLock<Vec<Arc<tokio_postgres::Client>>>>,
    next_index: Arc<AtomicU64>,
    pool_size: usize,
}

impl PostgresMessageMetadataRepository {
    const DEFAULT_POOL_SIZE: usize = 4;
    const MAX_POOL_SIZE: usize = 100;

    /// repository を生成する。
    /// @param database_url 接続文字列
    /// @param allow_postgres_notls 平文接続許可フラグ
    /// @returns repository
    /// @throws なし
    pub fn new(database_url: String, allow_postgres_notls: bool) -> Self {
        let pool_size = Self::parse_pool_size_from_env();
        Self {
            database_url: Arc::from(database_url),
            allow_postgres_notls,
            clients: Arc::new(RwLock::new(Vec::new())),
            next_index: Arc::new(AtomicU64::new(0)),
            pool_size,
        }
    }

    fn parse_pool_size_from_env() -> usize {
        match env::var("MESSAGE_METADATA_POOL_SIZE") {
            Ok(value) => match value.parse::<usize>() {
                Ok(0) => {
                    warn!(
                        env_var = "MESSAGE_METADATA_POOL_SIZE",
                        value = %value,
                        default = Self::DEFAULT_POOL_SIZE,
                        "pool size must be >= 1; fallback to default"
                    );
                    Self::DEFAULT_POOL_SIZE
                }
                Ok(parsed) if parsed > Self::MAX_POOL_SIZE => {
                    warn!(
                        env_var = "MESSAGE_METADATA_POOL_SIZE",
                        value = %value,
                        max = Self::MAX_POOL_SIZE,
                        "pool size exceeds upper bound; clamped"
                    );
                    Self::MAX_POOL_SIZE
                }
                Ok(parsed) => parsed,
                Err(error) => {
                    warn!(
                        env_var = "MESSAGE_METADATA_POOL_SIZE",
                        value = %value,
                        reason = %error,
                        default = Self::DEFAULT_POOL_SIZE,
                        "invalid pool size env value; fallback to default"
                    );
                    Self::DEFAULT_POOL_SIZE
                }
            },
            Err(_) => Self::DEFAULT_POOL_SIZE,
        }
    }

    async fn connect_client(&self) -> Result<Arc<tokio_postgres::Client>, MessageUsecaseError> {
        if !self.allow_postgres_notls {
            return Err(MessageUsecaseError::dependency_unavailable(
                "postgres_tls_required",
            ));
        }

        let (client, connection) = tokio_postgres::connect(self.database_url.as_ref(), NoTls)
            .await
            .map_err(|error| {
                MessageUsecaseError::dependency_unavailable(format!(
                    "message_metadata_connect_failed:{error}"
                ))
            })?;

        tokio::spawn(async move {
            if let Err(error) = connection.await {
                tracing::error!(reason = %error, "message metadata postgres connection error");
            }
        });

        Ok(Arc::new(client))
    }

    async fn ensure_pool(&self) -> Result<(), MessageUsecaseError> {
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

        for _ in 0..self.pool_size {
            guard.push(self.connect_client().await?);
        }
        Ok(())
    }

    async fn select_client(&self) -> Result<Arc<tokio_postgres::Client>, MessageUsecaseError> {
        self.ensure_pool().await?;
        let guard = self.clients.read().await;
        if guard.is_empty() {
            return Err(MessageUsecaseError::dependency_unavailable(
                "message_metadata_pool_empty",
            ));
        }
        let index = (self.next_index.fetch_add(1, Ordering::Relaxed) as usize) % guard.len();
        Ok(Arc::clone(&guard[index]))
    }

    async fn invalidate_pool(&self) {
        self.clients.write().await.clear();
    }

    fn map_channel_context_row(
        &self,
        row: Row,
    ) -> Result<GuildChannelContext, MessageUsecaseError> {
        Ok(GuildChannelContext {
            channel_id: row.try_get("channel_id").map_err(|error| {
                MessageUsecaseError::dependency_unavailable(format!(
                    "message_metadata_channel_id_decode_failed:{error}"
                ))
            })?,
            guild_id: row.try_get("guild_id").map_err(|error| {
                MessageUsecaseError::dependency_unavailable(format!(
                    "message_metadata_guild_id_decode_failed:{error}"
                ))
            })?,
            created_at: row.try_get("created_at").map_err(|error| {
                MessageUsecaseError::dependency_unavailable(format!(
                    "message_metadata_created_at_decode_failed:{error}"
                ))
            })?,
            last_message_id: row.try_get("last_message_id").map_err(|error| {
                MessageUsecaseError::dependency_unavailable(format!(
                    "message_metadata_last_message_id_decode_failed:{error}"
                ))
            })?,
            last_message_at: row.try_get("last_message_at").map_err(|error| {
                MessageUsecaseError::dependency_unavailable(format!(
                    "message_metadata_last_message_at_decode_failed:{error}"
                ))
            })?,
        })
    }
}

#[async_trait]
impl MessageMetadataRepository for PostgresMessageMetadataRepository {
    /// channel context を取得する。
    /// @param channel_id 対象 channel_id
    /// @returns channel context。未存在時は `None`
    /// @throws MessageUsecaseError 依存障害時
    async fn get_guild_channel_context(
        &self,
        channel_id: i64,
    ) -> Result<Option<GuildChannelContext>, MessageUsecaseError> {
        let client = self.select_client().await?;
        let row = match client
            .query_opt(SELECT_CHANNEL_CONTEXT_SQL, &[&channel_id])
            .await
        {
            Ok(row) => row,
            Err(error) => {
                self.invalidate_pool().await;
                return Err(MessageUsecaseError::dependency_unavailable(format!(
                    "message_metadata_context_query_failed:{error}"
                )));
            }
        };
        row.map(|value| self.map_channel_context_row(value))
            .transpose()
    }

    /// channel_last_message を monotonic に更新する。
    /// @param channel_id 対象 channel_id
    /// @param message_id 最新 message_id
    /// @param created_at 最新 created_at
    /// @returns 更新成功時は `()`
    /// @throws MessageUsecaseError 依存障害時
    async fn upsert_last_message(
        &self,
        channel_id: i64,
        message_id: i64,
        created_at: &str,
    ) -> Result<(), MessageUsecaseError> {
        let client = self.select_client().await?;
        if let Err(error) = client
            .execute(
                UPSERT_LAST_MESSAGE_SQL,
                &[&channel_id, &message_id, &created_at],
            )
            .await
        {
            self.invalidate_pool().await;
            return Err(MessageUsecaseError::dependency_unavailable(format!(
                "message_metadata_upsert_failed:{error}"
            )));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::{SELECT_CHANNEL_CONTEXT_SQL, UPSERT_LAST_MESSAGE_SQL};

    #[test]
    fn select_channel_context_sql_scopes_to_guild_text_channels() {
        assert!(SELECT_CHANNEL_CONTEXT_SQL.contains("c.type = 'guild_text'"));
        assert!(SELECT_CHANNEL_CONTEXT_SQL.contains("LEFT JOIN channel_last_message"));
    }

    #[test]
    fn upsert_last_message_sql_is_monotonic() {
        assert!(UPSERT_LAST_MESSAGE_SQL
            .contains("channel_last_message.last_message_at < EXCLUDED.last_message_at"));
        assert!(UPSERT_LAST_MESSAGE_SQL
            .contains("channel_last_message.last_message_id < EXCLUDED.last_message_id"));
    }
}
