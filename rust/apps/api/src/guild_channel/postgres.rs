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
    /// Postgresサービスを生成する。
    /// @param database_url 接続文字列
    /// @param allow_postgres_notls 平文接続許可フラグ
    /// @returns Postgresサービス
    /// @throws なし
    pub fn new(database_url: String, allow_postgres_notls: bool) -> Self {
        let pool_size = env::var("GUILD_CHANNEL_STORE_POOL_SIZE")
            .ok()
            .and_then(|value| value.parse::<usize>().ok())
            .unwrap_or(4)
            .max(1);

        Self {
            database_url: Arc::from(database_url),
            allow_postgres_notls,
            clients: Arc::new(RwLock::new(Vec::new())),
            next_index: Arc::new(AtomicU64::new(0)),
            pool_size,
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

    /// guild存在とメンバー所属を検証する。
    /// @param client Postgresクライアント
    /// @param principal_id 認証済みprincipal_id
    /// @param guild_id 対象guild_id
    /// @returns 検証成功時は `Ok(())`
    /// @throws GuildChannelError 非メンバー/未存在/依存障害時
    async fn ensure_guild_member(
        &self,
        client: &tokio_postgres::Client,
        principal_id: PrincipalId,
        guild_id: i64,
    ) -> Result<(), GuildChannelError> {
        let guild_exists = client
            .query_opt("SELECT 1 FROM guilds WHERE id = $1", &[&guild_id])
            .await
            .map_err(|error| {
                GuildChannelError::dependency_unavailable(format!(
                    "guild_lookup_failed:{error}"
                ))
            })?
            .is_some();

        if !guild_exists {
            return Err(GuildChannelError::not_found("guild_not_found"));
        }

        let is_member = client
            .query_opt(
                "SELECT 1 FROM guild_members WHERE guild_id = $1 AND user_id = $2",
                &[&guild_id, &principal_id.0],
            )
            .await
            .map_err(|error| {
                GuildChannelError::dependency_unavailable(format!(
                    "guild_membership_lookup_failed:{error}"
                ))
            })?
            .is_some();

        if !is_member {
            return Err(GuildChannelError::forbidden("guild_membership_required"));
        }

        Ok(())
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
            if db_error.code() == &SqlState::FOREIGN_KEY_VIOLATION {
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

        let rows = client
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
            .map_err(|error| {
                GuildChannelError::dependency_unavailable(format!("guild_list_query_failed:{error}"))
            })?;

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
        self.ensure_guild_member(&client, principal_id, guild_id).await?;

        let rows = client
            .query(
                "SELECT
                    id AS channel_id,
                    guild_id,
                    name,
                    to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS created_at_text
                 FROM channels
                 WHERE guild_id = $1
                   AND type = 'guild_text'
                 ORDER BY created_at ASC, id ASC",
                &[&guild_id],
            )
            .await
            .map_err(|error| {
                GuildChannelError::dependency_unavailable(format!(
                    "channel_list_query_failed:{error}"
                ))
            })?;

        let channels = rows
            .into_iter()
            .map(|row| ChannelSummary {
                channel_id: row.get::<&str, i64>("channel_id"),
                guild_id: row.get::<&str, i64>("guild_id"),
                name: row.get::<&str, String>("name"),
                created_at: row.get::<&str, String>("created_at_text"),
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
        self.ensure_guild_member(&client, principal_id, guild_id).await?;

        let row = match client
            .query_one(
                "INSERT INTO channels (type, guild_id, name, created_by)
                 VALUES ('guild_text', $1, $2, $3)
                 RETURNING
                    id AS channel_id,
                    guild_id,
                    name,
                    to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS created_at",
                &[&guild_id, &normalized_name, &principal_id.0],
            )
            .await
        {
            Ok(row) => row,
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
