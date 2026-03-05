/// Postgres-backed guild/channel サービスを表現する。
#[derive(Clone)]
pub struct PostgresGuildChannelService {
    database_url: Arc<str>,
    allow_postgres_notls: bool,
    clients: Arc<RwLock<Vec<Arc<tokio_postgres::Client>>>>,
    next_index: Arc<AtomicU64>,
    pool_size: usize,
}

impl PostgresGuildChannelService {
    const DEFAULT_POOL_SIZE: usize = 4;
    const MAX_POOL_SIZE: usize = 100;
    const CREATE_GUILD_CHANNEL_SQL: &str = "INSERT INTO channels (type, guild_id, name, created_by)
                 SELECT
                    'guild_text',
                    gm.guild_id,
                    $2,
                    $3
                 FROM guild_members gm
                 WHERE gm.guild_id = $1
                   AND gm.user_id = $3
                 FOR KEY SHARE
                 RETURNING
                    id AS channel_id,
                    guild_id,
                    name,
                    to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS created_at";
    const LIST_GUILD_CHANNELS_SQL: &str = "WITH member AS (
                    SELECT gm.guild_id
                    FROM guild_members gm
                    WHERE gm.guild_id = $1
                      AND gm.user_id = $2
                    FOR KEY SHARE
                 )
                 SELECT
                    c.id AS channel_id,
                    m.guild_id,
                    c.name,
                    to_char(c.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS created_at_text
                 FROM member m
                 LEFT JOIN channels c
                   ON c.guild_id = m.guild_id
                  AND c.type = 'guild_text'
                 ORDER BY c.created_at ASC NULLS LAST, c.id ASC NULLS LAST";
    const UPDATE_GUILD_SQL: &str = "WITH target AS (
                    SELECT id, owner_id
                    FROM guilds
                    WHERE id = $1
                    FOR UPDATE
                 ),
                 actor AS (
                    SELECT
                      t.id AS guild_id,
                      (t.owner_id = $2) AS is_owner,
                      EXISTS (
                        SELECT 1
                        FROM guild_member_roles_v2 gmr
                        JOIN guild_roles_v2 gr
                          ON gr.guild_id = gmr.guild_id
                         AND gr.role_key = gmr.role_key
                        WHERE gmr.guild_id = t.id
                          AND gmr.user_id = $2
                          AND gr.allow_manage = TRUE
                      ) AS can_manage
                    FROM target t
                 ),
                 updated AS (
                    UPDATE guilds g
                    SET
                      name = CASE WHEN $3::boolean THEN $4::text ELSE g.name END,
                      icon_key = CASE WHEN $5::boolean THEN $6::text ELSE g.icon_key END,
                      updated_at = now()
                    FROM actor a
                    WHERE g.id = a.guild_id
                      AND (a.is_owner OR a.can_manage)
                    RETURNING g.id, g.name, g.icon_key, g.owner_id
                 )
                 SELECT
                    id AS guild_id,
                    name,
                    icon_key,
                    owner_id
                 FROM updated";

    /// Postgresサービスを生成する。
    /// @param database_url 接続文字列
    /// @param allow_postgres_notls 平文接続許可フラグ
    /// @returns Postgresサービス
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

    /// 接続プールサイズを環境変数から解釈する。
    /// @param なし
    /// @returns プールサイズ
    /// @throws なし
    fn parse_pool_size_from_env() -> usize {
        match env::var("GUILD_CHANNEL_STORE_POOL_SIZE") {
            Ok(value) => match value.parse::<usize>() {
                Ok(0) => {
                    warn!(
                        env_var = "GUILD_CHANNEL_STORE_POOL_SIZE",
                        value = %value,
                        default = Self::DEFAULT_POOL_SIZE,
                        "pool size must be >= 1; fallback to default"
                    );
                    Self::DEFAULT_POOL_SIZE
                }
                Ok(parsed) if parsed > Self::MAX_POOL_SIZE => {
                    warn!(
                        env_var = "GUILD_CHANNEL_STORE_POOL_SIZE",
                        value = %value,
                        max = Self::MAX_POOL_SIZE,
                        "pool size exceeds upper bound; clamped"
                    );
                    Self::MAX_POOL_SIZE
                }
                Ok(parsed) => parsed,
                Err(error) => {
                    warn!(
                        env_var = "GUILD_CHANNEL_STORE_POOL_SIZE",
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

    /// Postgresクライアントを接続する。
    /// @param なし
    /// @returns Postgresクライアント
    /// @throws GuildChannelError 接続失敗時
    async fn connect_client(&self) -> Result<Arc<tokio_postgres::Client>, GuildChannelError> {
        if !self.allow_postgres_notls {
            return Err(GuildChannelError::dependency_unavailable(
                "postgres_tls_required",
            ));
        }

        let (client, connection) = tokio_postgres::connect(self.database_url.as_ref(), NoTls)
            .await
            .map_err(|error| {
                GuildChannelError::dependency_unavailable(format!("postgres_connect_failed:{error}"))
            })?;

        tokio::spawn(async move {
            if let Err(error) = connection.await {
                tracing::error!(reason = %error, "guild/channel postgres connection error");
            }
        });

        Ok(Arc::new(client))
    }

    /// 接続プールを初期化する。
    /// @param なし
    /// @returns 初期化結果
    /// @throws GuildChannelError 接続失敗時
    async fn ensure_pool(&self) -> Result<(), GuildChannelError> {
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

    /// 接続プールからクライアントを選択する。
    /// @param なし
    /// @returns 選択されたクライアント
    /// @throws GuildChannelError 接続未確立時
    async fn select_client(&self) -> Result<Arc<tokio_postgres::Client>, GuildChannelError> {
        self.ensure_pool().await?;

        let guard = self.clients.read().await;
        if guard.is_empty() {
            return Err(GuildChannelError::dependency_unavailable("postgres_pool_empty"));
        }

        let index = (self.next_index.fetch_add(1, Ordering::Relaxed) as usize) % guard.len();
        Ok(Arc::clone(&guard[index]))
    }

    /// 接続プールを破棄して再接続を促す。
    /// @param なし
    /// @returns なし
    /// @throws なし
    async fn invalidate_pool(&self) {
        let mut guard = self.clients.write().await;
        guard.clear();
    }

    /// 読み取り系DBエラーをAPIエラーへ変換する。
    /// @param context エラー文脈
    /// @param error Postgresエラー
    /// @returns APIエラー
    /// @throws なし
    async fn map_read_error(
        &self,
        context: &str,
        error: tokio_postgres::Error,
    ) -> GuildChannelError {
        if Self::should_invalidate_pool_for_read_error(&error) {
            self.invalidate_pool().await;
        }
        GuildChannelError::dependency_unavailable(format!("{context}:{error}"))
    }

    /// 読み取り系DBエラーでプール破棄が必要か判定する。
    /// @param error Postgresエラー
    /// @returns 接続断系エラーの場合は `true`
    /// @throws なし
    fn should_invalidate_pool_for_read_error(error: &tokio_postgres::Error) -> bool {
        if error.is_closed() {
            return true;
        }

        std::error::Error::source(error)
            .and_then(|source| source.downcast_ref::<std::io::Error>())
            .is_some()
    }

    /// guild存在を確認する。
    /// @param client Postgresクライアント
    /// @param guild_id 対象guild_id
    /// @returns guildが存在する場合は `true`
    /// @throws GuildChannelError 依存障害時
    async fn has_guild(
        &self,
        client: &tokio_postgres::Client,
        guild_id: i64,
    ) -> Result<bool, GuildChannelError> {
        match client
            .query_opt("SELECT 1 FROM guilds WHERE id = $1", &[&guild_id])
            .await
        {
            Ok(row) => Ok(row.is_some()),
            Err(error) => Err(self.map_read_error("guild_lookup_failed", error).await),
        }
    }

    /// principalがguild管理権限を持つか確認する。
    /// @param client Postgresクライアント
    /// @param principal_id 認証済みprincipal_id
    /// @param guild_id 対象guild_id
    /// @returns 管理権限がある場合は `true`
    /// @throws GuildChannelError 依存障害時
    async fn has_manage_permission(
        &self,
        client: &tokio_postgres::Client,
        principal_id: PrincipalId,
        guild_id: i64,
    ) -> Result<bool, GuildChannelError> {
        match client
            .query_opt(
                "SELECT 1
                 FROM guilds g
                 WHERE g.id = $1
                   AND g.owner_id = $2
                 UNION ALL
                 SELECT 1
                 FROM guild_member_roles_v2 gmr
                 JOIN guild_roles_v2 gr
                   ON gr.guild_id = gmr.guild_id
                  AND gr.role_key = gmr.role_key
                 WHERE gmr.guild_id = $1
                   AND gmr.user_id = $2
                   AND gr.allow_manage = TRUE
                 LIMIT 1",
                &[&guild_id, &principal_id.0],
            )
            .await
        {
            Ok(row) => Ok(row.is_some()),
            Err(error) => Err(self.map_read_error("guild_manage_permission_lookup_failed", error).await),
        }
    }

    /// 書き込み系DBエラーをAPIエラーへ変換する。
    /// @param context エラー文脈
    /// @param error Postgresエラー
    /// @returns APIエラー
    /// @throws なし
    fn map_write_error(context: &str, error: tokio_postgres::Error) -> GuildChannelError {
        if let Some(db_error) = error.as_db_error() {
            if db_error.code() == &SqlState::CHECK_VIOLATION {
                return GuildChannelError::validation("name_must_not_be_blank");
            }
            if db_error.code() == &SqlState::FOREIGN_KEY_VIOLATION
                && db_error.constraint() == Some("channels_guild_id_fkey")
            {
                return GuildChannelError::not_found("guild_not_found");
            }
        }

        GuildChannelError::dependency_unavailable(format!("{context}:{error}"))
    }
}

#[async_trait]
impl GuildChannelService for PostgresGuildChannelService {
    /// principalが所属するguild一覧を返す。
    /// @param principal_id 認証済みprincipal_id
    /// @returns guild一覧
    /// @throws GuildChannelError 依存障害時
    async fn list_guilds(
        &self,
        principal_id: PrincipalId,
    ) -> Result<Vec<GuildSummary>, GuildChannelError> {
        let client = self.select_client().await?;

        let rows = match client
            .query(
                "SELECT
                    g.id AS guild_id,
                    g.name,
                    g.icon_key,
                    to_char(gm.joined_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS joined_at
                 FROM guild_members gm
                 JOIN guilds g ON g.id = gm.guild_id
                 WHERE gm.user_id = $1
                 ORDER BY gm.joined_at DESC, gm.guild_id ASC",
                &[&principal_id.0],
            )
            .await
        {
            Ok(rows) => rows,
            Err(error) => return Err(self.map_read_error("guild_list_query_failed", error).await),
        };

        let guilds = rows
            .into_iter()
            .map(|row| GuildSummary {
                guild_id: row.get::<&str, i64>("guild_id"),
                name: row.get::<&str, String>("name"),
                icon_key: row.get::<&str, Option<String>>("icon_key"),
                joined_at: row.get::<&str, String>("joined_at"),
            })
            .collect();

        Ok(guilds)
    }

    /// guildを作成しowner bootstrapを実行する。
    /// @param principal_id 作成主体
    /// @param name guild名
    /// @returns 作成結果
    /// @throws GuildChannelError 入力不正または依存障害時
    async fn create_guild(
        &self,
        principal_id: PrincipalId,
        name: String,
    ) -> Result<CreatedGuild, GuildChannelError> {
        let normalized_name = normalize_non_empty_name(&name, "guild_name_required")?;
        let client = self.select_client().await?;
        let created = match client
            .query_one(
                "WITH created_guild AS (
                    INSERT INTO guilds (name, owner_id)
                    VALUES ($1, $2)
                    RETURNING id, name, icon_key, owner_id
                 ),
                 owner_member AS (
                    INSERT INTO guild_members (guild_id, user_id)
                    SELECT id, $2 FROM created_guild
                    ON CONFLICT (guild_id, user_id) DO NOTHING
                 ),
                 role_seed AS (
                    INSERT INTO guild_roles (guild_id, level, name)
                    SELECT id, level, role_name
                    FROM created_guild
                    CROSS JOIN (
                      VALUES
                        ('owner'::role_level, 'Owner'::text),
                        ('admin'::role_level, 'Admin'::text),
                        ('member'::role_level, 'Member'::text)
                    ) AS roles(level, role_name)
                    ON CONFLICT (guild_id, level) DO UPDATE
                    SET name = EXCLUDED.name
                 ),
                 owner_role AS (
                    INSERT INTO guild_member_roles (guild_id, user_id, level)
                    SELECT id, $2, 'owner'::role_level FROM created_guild
                    ON CONFLICT (guild_id, user_id) DO UPDATE
                    SET level = EXCLUDED.level
                 )
                 SELECT
                    id AS guild_id,
                    name,
                    icon_key,
                    owner_id
                 FROM created_guild",
                &[&normalized_name, &principal_id.0],
            )
            .await
        {
            Ok(row) => row,
            Err(error) => {
                self.invalidate_pool().await;
                return Err(Self::map_write_error("guild_create_query_failed", error));
            }
        };

        Ok(CreatedGuild {
            guild_id: created.get::<&str, i64>("guild_id"),
            name: created.get::<&str, String>("name"),
            icon_key: created.get::<&str, Option<String>>("icon_key"),
            owner_id: created.get::<&str, i64>("owner_id"),
        })
    }

    /// guild設定を更新する。
    /// @param principal_id 更新主体
    /// @param guild_id 対象guild_id
    /// @param patch 更新入力
    /// @returns 更新後guild
    /// @throws GuildChannelError 入力不正/非権限/未存在/依存障害時
    async fn update_guild(
        &self,
        principal_id: PrincipalId,
        guild_id: i64,
        patch: GuildPatchInput,
    ) -> Result<CreatedGuild, GuildChannelError> {
        if patch.is_empty() {
            return Err(GuildChannelError::validation("guild_patch_empty"));
        }

        let normalized_name = match patch.name {
            Some(name) => Some(normalize_guild_name(&name)?),
            None => None,
        };
        let normalized_icon_key = match patch.icon_key {
            Some(icon_key) => Some(normalize_icon_key(icon_key)?),
            None => None,
        };

        let set_name = normalized_name.is_some();
        let name_value = normalized_name.as_deref();
        let set_icon_key = normalized_icon_key.is_some();
        let icon_key_value = normalized_icon_key.as_ref().and_then(|value| value.as_deref());

        let client = self.select_client().await?;
        let updated = match client
            .query_opt(
                Self::UPDATE_GUILD_SQL,
                &[
                    &guild_id,
                    &principal_id.0,
                    &set_name,
                    &name_value,
                    &set_icon_key,
                    &icon_key_value,
                ],
            )
            .await
        {
            Ok(Some(row)) => row,
            Ok(None) => {
                if !self.has_guild(&client, guild_id).await? {
                    return Err(GuildChannelError::not_found("guild_not_found"));
                }
                if !self
                    .has_manage_permission(&client, principal_id, guild_id)
                    .await?
                {
                    return Err(GuildChannelError::forbidden("guild_manage_permission_required"));
                }
                return Err(GuildChannelError::dependency_unavailable(
                    "guild_update_rejected_without_reason",
                ));
            }
            Err(error) => {
                self.invalidate_pool().await;
                return Err(Self::map_write_error("guild_update_query_failed", error));
            }
        };

        Ok(CreatedGuild {
            guild_id: updated.get::<&str, i64>("guild_id"),
            name: updated.get::<&str, String>("name"),
            icon_key: updated.get::<&str, Option<String>>("icon_key"),
            owner_id: updated.get::<&str, i64>("owner_id"),
        })
    }

    /// guild配下のchannel一覧を返す。
    /// @param principal_id 認証済みprincipal_id
    /// @param guild_id 対象guild_id
    /// @returns channel一覧
    /// @throws GuildChannelError 非メンバー/未存在/依存障害時
    async fn list_guild_channels(
        &self,
        principal_id: PrincipalId,
        guild_id: i64,
    ) -> Result<Vec<ChannelSummary>, GuildChannelError> {
        let client = self.select_client().await?;
        let rows = match client
            .query(Self::LIST_GUILD_CHANNELS_SQL, &[&guild_id, &principal_id.0])
            .await
        {
            Ok(rows) => rows,
            Err(error) => return Err(self.map_read_error("channel_list_query_failed", error).await),
        };

        if rows.is_empty() {
            if self.has_guild(&client, guild_id).await? {
                return Err(GuildChannelError::forbidden("guild_membership_required"));
            }
            return Err(GuildChannelError::not_found("guild_not_found"));
        }

        let channels = rows
            .into_iter()
            .filter_map(|row| {
                let channel_id = row.get::<&str, Option<i64>>("channel_id")?;
                let name = row.get::<&str, Option<String>>("name")?;
                let created_at = row.get::<&str, Option<String>>("created_at_text")?;
                Some(ChannelSummary {
                    channel_id,
                    guild_id: row.get::<&str, i64>("guild_id"),
                    name,
                    created_at,
                })
            })
            .collect();

        Ok(channels)
    }

    /// guild配下へchannelを作成する。
    /// @param principal_id 作成主体
    /// @param guild_id 対象guild_id
    /// @param name channel名
    /// @returns 作成結果
    /// @throws GuildChannelError 入力不正/非メンバー/未存在/依存障害時
    async fn create_guild_channel(
        &self,
        principal_id: PrincipalId,
        guild_id: i64,
        name: String,
    ) -> Result<CreatedChannel, GuildChannelError> {
        let normalized_name = normalize_non_empty_name(&name, "channel_name_required")?;
        let client = self.select_client().await?;

        let row = match client
            .query_opt(
                Self::CREATE_GUILD_CHANNEL_SQL,
                &[&guild_id, &normalized_name, &principal_id.0],
            )
            .await
        {
            Ok(Some(row)) => row,
            Ok(None) => {
                if self.has_guild(&client, guild_id).await? {
                    return Err(GuildChannelError::forbidden("guild_membership_required"));
                }
                return Err(GuildChannelError::not_found("guild_not_found"));
            }
            Err(error) => {
                self.invalidate_pool().await;
                return Err(Self::map_write_error("channel_create_insert_failed", error));
            }
        };

        Ok(CreatedChannel {
            channel_id: row.get::<&str, i64>("channel_id"),
            guild_id: row.get::<&str, i64>("guild_id"),
            name: row.get::<&str, String>("name"),
            created_at: row.get::<&str, String>("created_at"),
        })
    }
}
