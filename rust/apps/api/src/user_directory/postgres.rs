/// Postgres-backed user directory サービスを表現する。
#[derive(Clone)]
pub struct PostgresUserDirectoryService {
    database_url: Arc<str>,
    allow_postgres_notls: bool,
    clients: Arc<RwLock<Vec<Arc<tokio_postgres::Client>>>>,
    next_index: Arc<AtomicU64>,
    pool_size: usize,
}

impl PostgresUserDirectoryService {
    const DEFAULT_POOL_SIZE: usize = 4;
    const MAX_POOL_SIZE: usize = 100;

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
        match env::var("USER_DIRECTORY_POOL_SIZE") {
            Ok(value) => match value.parse::<usize>() {
                Ok(0) => {
                    warn!(
                        env_var = "USER_DIRECTORY_POOL_SIZE",
                        value = %value,
                        default = Self::DEFAULT_POOL_SIZE,
                        "pool size must be >= 1; fallback to default"
                    );
                    Self::DEFAULT_POOL_SIZE
                }
                Ok(parsed) if parsed > Self::MAX_POOL_SIZE => {
                    warn!(
                        env_var = "USER_DIRECTORY_POOL_SIZE",
                        value = %value,
                        max = Self::MAX_POOL_SIZE,
                        "pool size exceeds upper bound; clamped"
                    );
                    Self::MAX_POOL_SIZE
                }
                Ok(parsed) => parsed,
                Err(error) => {
                    warn!(
                        env_var = "USER_DIRECTORY_POOL_SIZE",
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
    /// @throws UserDirectoryError 接続失敗時
    async fn connect_client(&self) -> Result<Arc<tokio_postgres::Client>, UserDirectoryError> {
        if !self.allow_postgres_notls {
            return Err(UserDirectoryError::dependency_unavailable(
                "postgres_tls_required",
            ));
        }

        let (client, connection) = tokio_postgres::connect(self.database_url.as_ref(), NoTls)
            .await
            .map_err(|error| {
                UserDirectoryError::dependency_unavailable(format!(
                    "user_directory_postgres_connect_failed:{error}"
                ))
            })?;

        tokio::spawn(async move {
            if let Err(error) = connection.await {
                tracing::error!(reason = %error, "user directory postgres connection error");
            }
        });

        Ok(Arc::new(client))
    }

    /// 接続プールを初期化する。
    /// @param なし
    /// @returns 初期化結果
    /// @throws UserDirectoryError 接続失敗時
    async fn ensure_pool(&self) -> Result<(), UserDirectoryError> {
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
    /// @throws UserDirectoryError 接続未確立時
    async fn select_client(&self) -> Result<Arc<tokio_postgres::Client>, UserDirectoryError> {
        self.ensure_pool().await?;

        let guard = self.clients.read().await;
        if guard.is_empty() {
            return Err(UserDirectoryError::dependency_unavailable(
                "postgres_pool_empty",
            ));
        }

        let index = (self.next_index.fetch_add(1, Ordering::Relaxed) as usize) % guard.len();
        Ok(Arc::clone(&guard[index]))
    }

    /// guild membership を検証する。
    /// @param client Postgres client
    /// @param guild_id 対象guild_id
    /// @param principal_id 認証済みprincipal_id
    /// @returns 検証結果
    /// @throws UserDirectoryError 依存障害時
    async fn ensure_guild_member(
        &self,
        client: &tokio_postgres::Client,
        guild_id: i64,
        principal_id: PrincipalId,
    ) -> Result<(), UserDirectoryError> {
        let row = client
            .query_one(
                "SELECT
                    EXISTS(SELECT 1 FROM guilds WHERE id = $1) AS guild_exists,
                    EXISTS(
                      SELECT 1
                      FROM guild_members
                      WHERE guild_id = $1
                        AND user_id = $2
                    ) AS is_member",
                &[&guild_id, &principal_id.0],
            )
            .await
            .map_err(|error| {
                UserDirectoryError::dependency_unavailable(format!(
                    "user_directory_guild_scope_query_failed:{error}"
                ))
            })?;

        let guild_exists = row.get::<&str, bool>("guild_exists");
        let is_member = row.get::<&str, bool>("is_member");

        if !guild_exists {
            return Err(UserDirectoryError::guild_not_found("guild_not_found"));
        }
        if !is_member {
            return Err(UserDirectoryError::forbidden("guild_membership_required"));
        }

        Ok(())
    }
}

#[async_trait]
impl UserDirectoryService for PostgresUserDirectoryService {
    /// guild member 一覧を返す。
    /// @param principal_id 認証済みprincipal_id
    /// @param guild_id 対象guild_id
    /// @returns member 一覧
    /// @throws UserDirectoryError 権限拒否/依存障害時
    async fn list_guild_members(
        &self,
        principal_id: PrincipalId,
        guild_id: i64,
    ) -> Result<Vec<GuildMemberDirectoryEntry>, UserDirectoryError> {
        let client = self.select_client().await?;
        self.ensure_guild_member(&client, guild_id, principal_id)
            .await?;

        let rows = client
            .query(
                "SELECT
                    u.id AS user_id,
                    u.display_name,
                    u.avatar_key,
                    u.status_text,
                    gm.nickname,
                    to_char(gm.joined_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS joined_at,
                    COALESCE(
                      ARRAY_AGG(gmr.role_key ORDER BY gr.priority DESC, gmr.role_key)
                        FILTER (WHERE gmr.role_key IS NOT NULL),
                      ARRAY[]::text[]
                    ) AS role_keys
                 FROM guild_members gm
                 JOIN users u
                   ON u.id = gm.user_id
                 LEFT JOIN guild_member_roles_v2 gmr
                   ON gmr.guild_id = gm.guild_id
                  AND gmr.user_id = gm.user_id
                 LEFT JOIN guild_roles_v2 gr
                   ON gr.guild_id = gmr.guild_id
                  AND gr.role_key = gmr.role_key
                 WHERE gm.guild_id = $1
                 GROUP BY u.id, u.display_name, u.avatar_key, u.status_text, gm.nickname, gm.joined_at
                 ORDER BY gm.joined_at ASC, u.id ASC",
                &[&guild_id],
            )
            .await
            .map_err(|error| {
                UserDirectoryError::dependency_unavailable(format!(
                    "user_directory_list_members_query_failed:{error}"
                ))
            })?;

        let mut members = Vec::with_capacity(rows.len());
        for row in rows {
            members.push(GuildMemberDirectoryEntry {
                user_id: row.get::<&str, i64>("user_id"),
                display_name: row.get::<&str, String>("display_name"),
                avatar_key: row.get::<&str, Option<String>>("avatar_key"),
                status_text: row.get::<&str, Option<String>>("status_text"),
                nickname: row.get::<&str, Option<String>>("nickname"),
                joined_at: row.get::<&str, String>("joined_at"),
                role_keys: row.get::<&str, Vec<String>>("role_keys"),
            });
        }

        Ok(members)
    }

    /// guild role 一覧を返す。
    /// @param principal_id 認証済みprincipal_id
    /// @param guild_id 対象guild_id
    /// @returns role 一覧
    /// @throws UserDirectoryError 権限拒否/依存障害時
    async fn list_guild_roles(
        &self,
        principal_id: PrincipalId,
        guild_id: i64,
    ) -> Result<Vec<GuildRoleDirectoryEntry>, UserDirectoryError> {
        let client = self.select_client().await?;
        self.ensure_guild_member(&client, guild_id, principal_id)
            .await?;

        let rows = client
            .query(
                "SELECT
                    gr.role_key,
                    gr.name,
                    gr.priority,
                    gr.allow_manage,
                    COUNT(gmr.user_id)::BIGINT AS member_count
                 FROM guild_roles_v2 gr
                 LEFT JOIN guild_member_roles_v2 gmr
                   ON gmr.guild_id = gr.guild_id
                  AND gmr.role_key = gr.role_key
                 WHERE gr.guild_id = $1
                 GROUP BY gr.role_key, gr.name, gr.priority, gr.allow_manage
                 ORDER BY gr.priority DESC, gr.role_key ASC",
                &[&guild_id],
            )
            .await
            .map_err(|error| {
                UserDirectoryError::dependency_unavailable(format!(
                    "user_directory_list_roles_query_failed:{error}"
                ))
            })?;

        let mut roles = Vec::with_capacity(rows.len());
        for row in rows {
            roles.push(GuildRoleDirectoryEntry {
                role_key: row.get::<&str, String>("role_key"),
                name: row.get::<&str, String>("name"),
                priority: row.get::<&str, i32>("priority"),
                allow_manage: row.get::<&str, bool>("allow_manage"),
                member_count: row.get::<&str, i64>("member_count"),
            });
        }

        Ok(roles)
    }

    /// 他ユーザープロフィールを返す。
    /// @param principal_id 認証済みprincipal_id
    /// @param user_id 対象user_id
    /// @returns プロフィール
    /// @throws UserDirectoryError 未存在/権限拒否/依存障害時
    async fn get_user_profile(
        &self,
        principal_id: PrincipalId,
        user_id: i64,
    ) -> Result<UserProfileDirectoryEntry, UserDirectoryError> {
        let client = self.select_client().await?;

        let scope_row = client
            .query_one(
                "SELECT
                    EXISTS(SELECT 1 FROM users WHERE id = $1) AS user_exists,
                    EXISTS(
                      SELECT 1
                      FROM guild_members target
                      JOIN guild_members requester
                        ON requester.guild_id = target.guild_id
                      WHERE target.user_id = $1
                        AND requester.user_id = $2
                    ) AS shares_guild",
                &[&user_id, &principal_id.0],
            )
            .await
            .map_err(|error| {
                UserDirectoryError::dependency_unavailable(format!(
                    "user_directory_profile_scope_query_failed:{error}"
                ))
            })?;

        let user_exists = scope_row.get::<&str, bool>("user_exists");
        let shares_guild = scope_row.get::<&str, bool>("shares_guild");

        if !user_exists {
            return Err(UserDirectoryError::user_not_found("user_not_found"));
        }
        if principal_id.0 != user_id && !shares_guild {
            return Err(UserDirectoryError::forbidden("shared_guild_required"));
        }

        let row = client
            .query_opt(
                "SELECT
                    id AS user_id,
                    display_name,
                    status_text,
                    avatar_key,
                    banner_key,
                    to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS created_at
                 FROM users
                 WHERE id = $1
                 LIMIT 1",
                &[&user_id],
            )
            .await
            .map_err(|error| {
                UserDirectoryError::dependency_unavailable(format!(
                    "user_directory_profile_query_failed:{error}"
                ))
            })?;

        let Some(row) = row else {
            return Err(UserDirectoryError::user_not_found("user_not_found"));
        };

        Ok(UserProfileDirectoryEntry {
            user_id: row.get::<&str, i64>("user_id"),
            display_name: row.get::<&str, String>("display_name"),
            status_text: row.get::<&str, Option<String>>("status_text"),
            avatar_key: row.get::<&str, Option<String>>("avatar_key"),
            banner_key: row.get::<&str, Option<String>>("banner_key"),
            created_at: row.get::<&str, String>("created_at"),
        })
    }
}
