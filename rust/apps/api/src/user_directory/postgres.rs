const MEMBER_ROLE_KEY: &str = "member";
const OWNER_ROLE_KEY: &str = "owner";
const FIRST_CUSTOM_ROLE_PRIORITY: i32 = 99;
const ROLE_KEY_MAX_LEN: usize = 64;
const ROLE_NAME_MAX_LEN: usize = 100;
const AUTHZ_TUPLE_EVENT_GUILD_ROLE: &str = "authz.tuple.guild_role.v1";
const AUTHZ_TUPLE_EVENT_GUILD_MEMBER_ROLE: &str = "authz.tuple.guild_member_role.v1";
const AUTHZ_TUPLE_EVENT_CHANNEL_ROLE_OVERRIDE: &str = "authz.tuple.channel_role_override.v1";
const AUTHZ_TUPLE_EVENT_CHANNEL_USER_OVERRIDE: &str = "authz.tuple.channel_user_override.v1";

/// Postgres-backed user directory サービスを表現する。
#[derive(Clone)]
pub struct PostgresUserDirectoryService {
    database_url: Arc<str>,
    allow_postgres_notls: bool,
    clients: Arc<RwLock<Vec<Arc<tokio_postgres::Client>>>>,
    next_index: Arc<AtomicU64>,
    pool_size: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct GuildRoleState {
    role_key: String,
    name: String,
    priority: i32,
    allow_view: bool,
    allow_post: bool,
    allow_manage: bool,
    is_system: bool,
}

impl GuildRoleState {
    fn to_directory_entry(&self, member_count: i64) -> GuildRoleDirectoryEntry {
        GuildRoleDirectoryEntry {
            role_key: self.role_key.clone(),
            name: self.name.clone(),
            priority: self.priority,
            allow_view: self.allow_view,
            allow_post: self.allow_post,
            allow_manage: self.allow_manage,
            is_system: self.is_system,
            member_count,
        }
    }
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
    /// @returns 共有Postgresクライアント
    /// @throws UserDirectoryError 接続失敗時
    async fn connect_client(&self) -> Result<Arc<tokio_postgres::Client>, UserDirectoryError> {
        let client = self.connect_owned_client().await?;
        Ok(Arc::new(client))
    }

    /// transaction 用の専用Postgresクライアントを接続する。
    /// @param なし
    /// @returns 専用Postgresクライアント
    /// @throws UserDirectoryError 接続失敗時
    async fn connect_owned_client(&self) -> Result<tokio_postgres::Client, UserDirectoryError> {
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

        Ok(client)
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

    /// guild が存在するかを確認する。
    /// @param client Postgres client
    /// @param guild_id 対象guild_id
    /// @returns 存在する場合は `true`
    /// @throws UserDirectoryError 依存障害時
    async fn has_guild<C>(&self, client: &C, guild_id: i64) -> Result<bool, UserDirectoryError>
    where
        C: GenericClient + Sync,
    {
        client
            .query_opt("SELECT 1 FROM guilds WHERE id = $1", &[&guild_id])
            .await
            .map(|row| row.is_some())
            .map_err(|error| {
                UserDirectoryError::dependency_unavailable(format!(
                    "user_directory_guild_lookup_failed:{error}"
                ))
            })
    }

    /// guild member が存在するかを確認する。
    /// @param client Postgres client
    /// @param guild_id 対象guild_id
    /// @param user_id 対象user_id
    /// @returns 存在する場合は `true`
    /// @throws UserDirectoryError 依存障害時
    async fn is_guild_member<C>(
        &self,
        client: &C,
        guild_id: i64,
        user_id: i64,
    ) -> Result<bool, UserDirectoryError>
    where
        C: GenericClient + Sync,
    {
        client
            .query_opt(
                "SELECT 1
                 FROM guild_members
                 WHERE guild_id = $1
                   AND user_id = $2",
                &[&guild_id, &user_id],
            )
            .await
            .map(|row| row.is_some())
            .map_err(|error| {
                UserDirectoryError::dependency_unavailable(format!(
                    "user_directory_guild_member_lookup_failed:{error}"
                ))
            })
    }

    /// member 存在を検証する。
    /// @param client Postgres client
    /// @param guild_id 対象guild_id
    /// @param member_id 対象member_id
    /// @returns なし
    /// @throws UserDirectoryError 未存在/依存障害時
    async fn ensure_target_member_exists<C>(
        &self,
        client: &C,
        guild_id: i64,
        member_id: i64,
    ) -> Result<(), UserDirectoryError>
    where
        C: GenericClient + Sync,
    {
        if self.is_guild_member(client, guild_id, member_id).await? {
            return Ok(());
        }
        if !self.has_guild(client, guild_id).await? {
            return Err(UserDirectoryError::guild_not_found("guild_not_found"));
        }
        Err(UserDirectoryError::member_not_found("member_not_found"))
    }

    /// channel 存在を検証する。
    /// @param client Postgres client
    /// @param guild_id 対象guild_id
    /// @param channel_id 対象channel_id
    /// @returns なし
    /// @throws UserDirectoryError 未存在/依存障害時
    async fn ensure_target_channel_exists<C>(
        &self,
        client: &C,
        guild_id: i64,
        channel_id: i64,
    ) -> Result<(), UserDirectoryError>
    where
        C: GenericClient + Sync,
    {
        let row = client
            .query_opt(
                "SELECT 1
                 FROM channels
                 WHERE id = $1
                   AND guild_id = $2
                   AND type IN ('guild_text', 'guild_category')",
                &[&channel_id, &guild_id],
            )
            .await
            .map_err(|error| {
                UserDirectoryError::dependency_unavailable(format!(
                    "user_directory_channel_scope_query_failed:{error}"
                ))
            })?;

        if row.is_some() {
            return Ok(());
        }

        if !self.has_guild(client, guild_id).await? {
            return Err(UserDirectoryError::guild_not_found("guild_not_found"));
        }

        Err(UserDirectoryError::channel_not_found("channel_not_found"))
    }

    /// role state を読み出す。
    /// @param client Postgres client
    /// @param guild_id 対象guild_id
    /// @param role_key 対象role_key
    /// @returns role state
    /// @throws UserDirectoryError 未存在/依存障害時
    async fn get_role_state<C>(
        &self,
        client: &C,
        guild_id: i64,
        role_key: &str,
    ) -> Result<GuildRoleState, UserDirectoryError>
    where
        C: GenericClient + Sync,
    {
        let row = client
            .query_opt(
                "SELECT
                    role_key,
                    name,
                    priority,
                    allow_view,
                    allow_post,
                    allow_manage,
                    is_system
                 FROM guild_roles_v2
                 WHERE guild_id = $1
                   AND role_key = $2",
                &[&guild_id, &role_key],
            )
            .await
            .map_err(|error| {
                UserDirectoryError::dependency_unavailable(format!(
                    "user_directory_role_lookup_failed:{error}"
                ))
            })?;

        let Some(row) = row else {
            return Err(UserDirectoryError::role_not_found("role_not_found"));
        };

        Ok(GuildRoleState {
            role_key: row.get::<&str, String>("role_key"),
            name: row.get::<&str, String>("name"),
            priority: row.get::<&str, i32>("priority"),
            allow_view: row.get::<&str, bool>("allow_view"),
            allow_post: row.get::<&str, bool>("allow_post"),
            allow_manage: row.get::<&str, bool>("allow_manage"),
            is_system: row.get::<&str, bool>("is_system"),
        })
    }

    /// role 一覧を読み出す。
    /// @param client Postgres client
    /// @param guild_id 対象guild_id
    /// @returns role 一覧
    /// @throws UserDirectoryError 依存障害時
    async fn load_guild_roles<C>(
        &self,
        client: &C,
        guild_id: i64,
    ) -> Result<Vec<GuildRoleDirectoryEntry>, UserDirectoryError>
    where
        C: GenericClient + Sync,
    {
        let rows = client
            .query(
                "SELECT
                    gr.role_key,
                    gr.name,
                    gr.priority,
                    gr.allow_view,
                    gr.allow_post,
                    gr.allow_manage,
                    gr.is_system,
                    COUNT(gmr.user_id)::BIGINT AS member_count
                 FROM guild_roles_v2 gr
                 LEFT JOIN guild_member_roles_v2 gmr
                   ON gmr.guild_id = gr.guild_id
                  AND gmr.role_key = gr.role_key
                 WHERE gr.guild_id = $1
                 GROUP BY
                    gr.role_key,
                    gr.name,
                    gr.priority,
                    gr.allow_view,
                    gr.allow_post,
                    gr.allow_manage,
                    gr.is_system
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
                allow_view: row.get::<&str, bool>("allow_view"),
                allow_post: row.get::<&str, bool>("allow_post"),
                allow_manage: row.get::<&str, bool>("allow_manage"),
                is_system: row.get::<&str, bool>("is_system"),
                member_count: row.get::<&str, i64>("member_count"),
            });
        }

        Ok(roles)
    }

    /// member 一覧を読み出す。
    /// @param client Postgres client
    /// @param guild_id 対象guild_id
    /// @returns member 一覧
    /// @throws UserDirectoryError 依存障害時
    async fn load_guild_members<C>(
        &self,
        client: &C,
        guild_id: i64,
    ) -> Result<Vec<GuildMemberDirectoryEntry>, UserDirectoryError>
    where
        C: GenericClient + Sync,
    {
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

    /// 単一member を読み出す。
    /// @param client Postgres client
    /// @param guild_id 対象guild_id
    /// @param member_id 対象member_id
    /// @returns member
    /// @throws UserDirectoryError 未存在/依存障害時
    async fn load_guild_member_entry<C>(
        &self,
        client: &C,
        guild_id: i64,
        member_id: i64,
    ) -> Result<GuildMemberDirectoryEntry, UserDirectoryError>
    where
        C: GenericClient + Sync,
    {
        let row = client
            .query_opt(
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
                   AND gm.user_id = $2
                 GROUP BY u.id, u.display_name, u.avatar_key, u.status_text, gm.nickname, gm.joined_at",
                &[&guild_id, &member_id],
            )
            .await
            .map_err(|error| {
                UserDirectoryError::dependency_unavailable(format!(
                    "user_directory_member_query_failed:{error}"
                ))
            })?;

        let Some(row) = row else {
            return Err(UserDirectoryError::member_not_found("member_not_found"));
        };

        Ok(GuildMemberDirectoryEntry {
            user_id: row.get::<&str, i64>("user_id"),
            display_name: row.get::<&str, String>("display_name"),
            avatar_key: row.get::<&str, Option<String>>("avatar_key"),
            status_text: row.get::<&str, Option<String>>("status_text"),
            nickname: row.get::<&str, Option<String>>("nickname"),
            joined_at: row.get::<&str, String>("joined_at"),
            role_keys: row.get::<&str, Vec<String>>("role_keys"),
        })
    }

    /// channel permission を読み出す。
    /// @param client Postgres client
    /// @param guild_id 対象guild_id
    /// @param channel_id 対象channel_id
    /// @returns permission 一覧
    /// @throws UserDirectoryError 依存障害時
    async fn load_channel_permissions<C>(
        &self,
        client: &C,
        guild_id: i64,
        channel_id: i64,
    ) -> Result<ChannelPermissionDirectoryEntry, UserDirectoryError>
    where
        C: GenericClient + Sync,
    {
        let role_rows = client
            .query(
                "SELECT
                    cro.role_key,
                    gr.name,
                    gr.is_system,
                    cro.can_view,
                    cro.can_post
                 FROM channel_role_permission_overrides_v2 cro
                 JOIN guild_roles_v2 gr
                   ON gr.guild_id = cro.guild_id
                  AND gr.role_key = cro.role_key
                 WHERE cro.guild_id = $1
                   AND cro.channel_id = $2
                 ORDER BY gr.priority DESC, cro.role_key ASC",
                &[&guild_id, &channel_id],
            )
            .await
            .map_err(|error| {
                UserDirectoryError::dependency_unavailable(format!(
                    "user_directory_channel_role_permissions_query_failed:{error}"
                ))
            })?;

        let user_rows = client
            .query(
                "SELECT
                    cuo.user_id,
                    u.display_name,
                    cuo.can_view,
                    cuo.can_post
                 FROM channel_user_permission_overrides_v2 cuo
                 JOIN users u
                   ON u.id = cuo.user_id
                 WHERE cuo.guild_id = $1
                   AND cuo.channel_id = $2
                 ORDER BY cuo.user_id ASC",
                &[&guild_id, &channel_id],
            )
            .await
            .map_err(|error| {
                UserDirectoryError::dependency_unavailable(format!(
                    "user_directory_channel_user_permissions_query_failed:{error}"
                ))
            })?;

        let mut role_overrides = Vec::with_capacity(role_rows.len());
        for row in role_rows {
            role_overrides.push(ChannelRolePermissionOverrideEntry {
                role_key: row.get::<&str, String>("role_key"),
                subject_name: row.get::<&str, String>("name"),
                is_system: row.get::<&str, bool>("is_system"),
                can_view: PermissionOverrideValue::from_option_bool(
                    row.get::<&str, Option<bool>>("can_view"),
                ),
                can_post: PermissionOverrideValue::from_option_bool(
                    row.get::<&str, Option<bool>>("can_post"),
                ),
            });
        }

        let mut user_overrides = Vec::with_capacity(user_rows.len());
        for row in user_rows {
            user_overrides.push(ChannelUserPermissionOverrideEntry {
                user_id: row.get::<&str, i64>("user_id"),
                subject_name: row.get::<&str, String>("display_name"),
                can_view: PermissionOverrideValue::from_option_bool(
                    row.get::<&str, Option<bool>>("can_view"),
                ),
                can_post: PermissionOverrideValue::from_option_bool(
                    row.get::<&str, Option<bool>>("can_post"),
                ),
            });
        }

        Ok(ChannelPermissionDirectoryEntry {
            role_overrides,
            user_overrides,
        })
    }

    /// role 名を正規化する。
    /// @param name 入力名
    /// @returns trim 済み role 名
    /// @throws UserDirectoryError 検証失敗時
    fn normalize_role_name(&self, name: &str) -> Result<String, UserDirectoryError> {
        let normalized = name.trim();
        if normalized.is_empty() {
            return Err(UserDirectoryError::validation("role_name_required"));
        }
        if normalized.chars().count() > ROLE_NAME_MAX_LEN {
            return Err(UserDirectoryError::validation("role_name_too_long"));
        }
        Ok(normalized.to_owned())
    }

    /// role key を正規化する。
    /// @param role_key 入力role_key
    /// @returns 正規化済み role_key
    /// @throws UserDirectoryError 検証失敗時
    fn normalize_role_key(&self, role_key: &str) -> Result<String, UserDirectoryError> {
        let normalized = role_key.trim().to_ascii_lowercase();
        if normalized.is_empty() || normalized.len() > ROLE_KEY_MAX_LEN {
            return Err(UserDirectoryError::validation("role_key_invalid"));
        }
        if !normalized
            .chars()
            .all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '_')
        {
            return Err(UserDirectoryError::validation("role_key_invalid"));
        }
        Ok(normalized)
    }

    /// role 名から slug ベースの role key を作る。
    /// @param name 正規化済み role 名
    /// @returns role key base
    /// @throws なし
    fn slugify_role_key(&self, name: &str) -> String {
        let mut output = String::new();
        let mut last_was_underscore = false;

        for ch in name.chars() {
            let normalized = ch.to_ascii_lowercase();
            if normalized.is_ascii_lowercase() || normalized.is_ascii_digit() {
                output.push(normalized);
                last_was_underscore = false;
                continue;
            }
            if !last_was_underscore {
                output.push('_');
                last_was_underscore = true;
            }
        }

        let trimmed = output.trim_matches('_').to_owned();
        let mut base = if trimmed.is_empty() {
            "role".to_owned()
        } else {
            trimmed
        };
        if base.len() > ROLE_KEY_MAX_LEN {
            base.truncate(ROLE_KEY_MAX_LEN);
        }
        base.trim_matches('_').to_owned()
    }

    /// suffix 付き role key 候補を作る。
    /// @param base role key base
    /// @param suffix 連番
    /// @returns 候補role_key
    /// @throws なし
    fn role_key_with_suffix(&self, base: &str, suffix: usize) -> String {
        let suffix_value = format!("_{suffix}");
        let max_base_len = ROLE_KEY_MAX_LEN.saturating_sub(suffix_value.len());
        let mut prefix = base.to_owned();
        if prefix.len() > max_base_len {
            prefix.truncate(max_base_len);
            prefix = prefix.trim_matches('_').to_owned();
        }
        format!("{prefix}{suffix_value}")
    }

    /// 未使用の role key を確保する。
    /// @param client Postgres client
    /// @param guild_id 対象guild_id
    /// @param name 正規化済み role 名
    /// @returns 一意 role key
    /// @throws UserDirectoryError 依存障害時
    async fn allocate_role_key<C>(
        &self,
        client: &C,
        guild_id: i64,
        name: &str,
    ) -> Result<String, UserDirectoryError>
    where
        C: GenericClient + Sync,
    {
        let base = self.slugify_role_key(name);
        for suffix in 0..10_000usize {
            let candidate = if suffix == 0 {
                base.clone()
            } else {
                self.role_key_with_suffix(&base, suffix)
            };
            let exists = client
                .query_opt(
                    "SELECT 1
                     FROM guild_roles_v2
                     WHERE guild_id = $1
                       AND role_key = $2",
                    &[&guild_id, &candidate],
                )
                .await
                .map_err(|error| {
                    UserDirectoryError::dependency_unavailable(format!(
                        "user_directory_role_key_lookup_failed:{error}"
                    ))
                })?;
            if exists.is_none() {
                return Ok(candidate);
            }
        }
        Err(UserDirectoryError::dependency_unavailable(
            "role_key_allocation_exhausted",
        ))
    }

    /// custom role priority の初期値を求める。
    /// @param client Postgres client
    /// @param guild_id 対象guild_id
    /// @returns 新priority
    /// @throws UserDirectoryError 依存障害時
    async fn next_custom_role_priority<C>(
        &self,
        client: &C,
        guild_id: i64,
    ) -> Result<i32, UserDirectoryError>
    where
        C: GenericClient + Sync,
    {
        let row = client
            .query_one(
                "SELECT COALESCE(MIN(priority), $2)::INT AS min_priority
                 FROM guild_roles_v2
                 WHERE guild_id = $1
                   AND is_system = FALSE",
                &[&guild_id, &FIRST_CUSTOM_ROLE_PRIORITY],
            )
            .await
            .map_err(|error| {
                UserDirectoryError::dependency_unavailable(format!(
                    "user_directory_custom_role_priority_query_failed:{error}"
                ))
            })?;
        let min_priority = row.get::<&str, i32>("min_priority");
        if min_priority >= FIRST_CUSTOM_ROLE_PRIORITY {
            Ok(FIRST_CUSTOM_ROLE_PRIORITY)
        } else {
            Ok(min_priority - 1)
        }
    }

    /// outbox event を追加する。
    /// @param client Postgres client
    /// @param event_type event type
    /// @param aggregate_id aggregate id
    /// @param payload event payload
    /// @returns なし
    /// @throws UserDirectoryError 依存障害時
    async fn insert_outbox_event<C>(
        &self,
        client: &C,
        event_type: &str,
        aggregate_id: &str,
        payload: &serde_json::Value,
    ) -> Result<(), UserDirectoryError>
    where
        C: GenericClient + Sync,
    {
        let payload_text = payload.to_string();
        client
            .execute(
                "INSERT INTO outbox_events (event_type, aggregate_id, payload)
                 VALUES ($1, $2, $3::jsonb)",
                &[&event_type, &aggregate_id, &payload_text],
            )
            .await
            .map_err(|error| {
                UserDirectoryError::dependency_unavailable(format!(
                    "user_directory_outbox_insert_failed:{error}"
                ))
            })?;
        Ok(())
    }

    /// guild role 用 outbox event を追加する。
    /// @param client Postgres client
    /// @param op 操作
    /// @param role role state
    /// @returns なし
    /// @throws UserDirectoryError 依存障害時
    async fn enqueue_guild_role_event<C>(
        &self,
        client: &C,
        op: &str,
        role: &GuildRoleState,
        guild_id: i64,
    ) -> Result<(), UserDirectoryError>
    where
        C: GenericClient + Sync,
    {
        self.insert_outbox_event(
            client,
            AUTHZ_TUPLE_EVENT_GUILD_ROLE,
            &format!("guild:{guild_id}/role:{}", role.role_key),
            &serde_json::json!({
                "op": op,
                "guild_id": guild_id,
                "role_key": role.role_key,
                "allow_view": role.allow_view,
                "allow_post": role.allow_post,
                "allow_manage": role.allow_manage,
            }),
        )
        .await
    }

    /// guild member role 用 outbox event を追加する。
    /// @param client Postgres client
    /// @param op 操作
    /// @param guild_id 対象guild_id
    /// @param user_id 対象user_id
    /// @param role_key 対象role_key
    /// @returns なし
    /// @throws UserDirectoryError 依存障害時
    async fn enqueue_guild_member_role_event<C>(
        &self,
        client: &C,
        op: &str,
        guild_id: i64,
        user_id: i64,
        role_key: &str,
    ) -> Result<(), UserDirectoryError>
    where
        C: GenericClient + Sync,
    {
        self.insert_outbox_event(
            client,
            AUTHZ_TUPLE_EVENT_GUILD_MEMBER_ROLE,
            &format!("guild:{guild_id}/user:{user_id}/role:{role_key}"),
            &serde_json::json!({
                "op": op,
                "guild_id": guild_id,
                "user_id": user_id,
                "role_key": role_key,
            }),
        )
        .await
    }

    /// channel role override 用 outbox event を追加する。
    /// @param client Postgres client
    /// @param op 操作
    /// @param guild_id 対象guild_id
    /// @param channel_id 対象channel_id
    /// @param role_key 対象role_key
    /// @param values tri-state view/post
    /// @returns なし
    /// @throws UserDirectoryError 依存障害時
    async fn enqueue_channel_role_override_event<C>(
        &self,
        client: &C,
        op: &str,
        guild_id: i64,
        channel_id: i64,
        role_key: &str,
        values: (Option<bool>, Option<bool>),
    ) -> Result<(), UserDirectoryError>
    where
        C: GenericClient + Sync,
    {
        self.insert_outbox_event(
            client,
            AUTHZ_TUPLE_EVENT_CHANNEL_ROLE_OVERRIDE,
            &format!("channel:{channel_id}/role:{role_key}"),
            &serde_json::json!({
                "op": op,
                "guild_id": guild_id,
                "channel_id": channel_id,
                "role_key": role_key,
                "can_view": values.0,
                "can_post": values.1,
            }),
        )
        .await
    }

    /// channel user override 用 outbox event を追加する。
    /// @param client Postgres client
    /// @param op 操作
    /// @param guild_id 対象guild_id
    /// @param channel_id 対象channel_id
    /// @param user_id 対象user_id
    /// @param values tri-state view/post
    /// @returns なし
    /// @throws UserDirectoryError 依存障害時
    async fn enqueue_channel_user_override_event<C>(
        &self,
        client: &C,
        op: &str,
        guild_id: i64,
        channel_id: i64,
        user_id: i64,
        values: (Option<bool>, Option<bool>),
    ) -> Result<(), UserDirectoryError>
    where
        C: GenericClient + Sync,
    {
        self.insert_outbox_event(
            client,
            AUTHZ_TUPLE_EVENT_CHANNEL_USER_OVERRIDE,
            &format!("channel:{channel_id}/user:{user_id}"),
            &serde_json::json!({
                "op": op,
                "guild_id": guild_id,
                "channel_id": channel_id,
                "user_id": user_id,
                "can_view": values.0,
                "can_post": values.1,
            }),
        )
        .await
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
        _principal_id: PrincipalId,
        guild_id: i64,
    ) -> Result<Vec<GuildMemberDirectoryEntry>, UserDirectoryError> {
        let client = self.select_client().await?;
        if !self.has_guild(&*client, guild_id).await? {
            return Err(UserDirectoryError::guild_not_found("guild_not_found"));
        }
        self.load_guild_members(&*client, guild_id).await
    }

    /// guild role 一覧を返す。
    /// @param principal_id 認証済みprincipal_id
    /// @param guild_id 対象guild_id
    /// @returns role 一覧
    /// @throws UserDirectoryError 権限拒否/依存障害時
    async fn list_guild_roles(
        &self,
        _principal_id: PrincipalId,
        guild_id: i64,
    ) -> Result<Vec<GuildRoleDirectoryEntry>, UserDirectoryError> {
        let client = self.select_client().await?;
        if !self.has_guild(&*client, guild_id).await? {
            return Err(UserDirectoryError::guild_not_found("guild_not_found"));
        }
        self.load_guild_roles(&*client, guild_id).await
    }

    /// guild role を作成する。
    /// @param principal_id 認証済みprincipal_id
    /// @param guild_id 対象guild_id
    /// @param input 作成入力
    /// @returns 作成済み role
    /// @throws UserDirectoryError 検証失敗/権限拒否/依存障害時
    async fn create_guild_role(
        &self,
        _principal_id: PrincipalId,
        guild_id: i64,
        input: CreateGuildRoleInput,
    ) -> Result<GuildRoleDirectoryEntry, UserDirectoryError> {
        let normalized_name = self.normalize_role_name(&input.name)?;
        let mut client = self.connect_owned_client().await?;
        let transaction = client.transaction().await.map_err(|error| {
            UserDirectoryError::dependency_unavailable(format!(
                "user_directory_transaction_start_failed:{error}"
            ))
        })?;

        if !self.has_guild(&transaction, guild_id).await? {
            return Err(UserDirectoryError::guild_not_found("guild_not_found"));
        }
        let role_key = self
            .allocate_role_key(&transaction, guild_id, &normalized_name)
            .await?;
        let priority = self.next_custom_role_priority(&transaction, guild_id).await?;

        transaction
            .execute(
                "INSERT INTO guild_roles_v2 (
                    guild_id,
                    role_key,
                    name,
                    priority,
                    allow_view,
                    allow_post,
                    allow_manage,
                    is_system
                 ) VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE)",
                &[
                    &guild_id,
                    &role_key,
                    &normalized_name,
                    &priority,
                    &input.allow_view,
                    &input.allow_post,
                    &input.allow_manage,
                ],
            )
            .await
            .map_err(|error| {
                UserDirectoryError::dependency_unavailable(format!(
                    "user_directory_role_insert_failed:{error}"
                ))
            })?;

        let role = GuildRoleState {
            role_key,
            name: normalized_name,
            priority,
            allow_view: input.allow_view,
            allow_post: input.allow_post,
            allow_manage: input.allow_manage,
            is_system: false,
        };
        self.enqueue_guild_role_event(&transaction, "upsert", &role, guild_id)
            .await?;

        transaction.commit().await.map_err(|error| {
            UserDirectoryError::dependency_unavailable(format!(
                "user_directory_transaction_commit_failed:{error}"
            ))
        })?;

        Ok(role.to_directory_entry(0))
    }

    /// guild role を更新する。
    /// @param principal_id 認証済みprincipal_id
    /// @param guild_id 対象guild_id
    /// @param role_key 対象role_key
    /// @param patch 更新内容
    /// @returns 更新済み role
    /// @throws UserDirectoryError 検証失敗/権限拒否/依存障害時
    async fn update_guild_role(
        &self,
        _principal_id: PrincipalId,
        guild_id: i64,
        role_key: &str,
        patch: GuildRolePatchInput,
    ) -> Result<GuildRoleDirectoryEntry, UserDirectoryError> {
        if patch.is_empty() {
            return Err(UserDirectoryError::validation("role_patch_empty"));
        }
        let normalized_role_key = self.normalize_role_key(role_key)?;
        let normalized_name = match patch.name.as_deref() {
            Some(value) => Some(self.normalize_role_name(value)?),
            None => None,
        };

        let mut client = self.connect_owned_client().await?;
        let transaction = client.transaction().await.map_err(|error| {
            UserDirectoryError::dependency_unavailable(format!(
                "user_directory_transaction_start_failed:{error}"
            ))
        })?;

        if !self.has_guild(&transaction, guild_id).await? {
            return Err(UserDirectoryError::guild_not_found("guild_not_found"));
        }
        let current = self
            .get_role_state(&transaction, guild_id, &normalized_role_key)
            .await?;
        if current.is_system {
            return Err(UserDirectoryError::forbidden("system_role_update_forbidden"));
        }

        transaction
            .execute(
                "UPDATE guild_roles_v2
                 SET name = COALESCE($3, name),
                     allow_view = COALESCE($4, allow_view),
                     allow_post = COALESCE($5, allow_post),
                     allow_manage = COALESCE($6, allow_manage),
                     updated_at = now()
                 WHERE guild_id = $1
                   AND role_key = $2",
                &[
                    &guild_id,
                    &normalized_role_key,
                    &normalized_name,
                    &patch.allow_view,
                    &patch.allow_post,
                    &patch.allow_manage,
                ],
            )
            .await
            .map_err(|error| {
                UserDirectoryError::dependency_unavailable(format!(
                    "user_directory_role_update_failed:{error}"
                ))
            })?;

        let updated = self
            .get_role_state(&transaction, guild_id, &normalized_role_key)
            .await?;
        self.enqueue_guild_role_event(&transaction, "upsert", &updated, guild_id)
            .await?;
        let member_count = transaction
            .query_one(
                "SELECT COUNT(*)::BIGINT AS member_count
                 FROM guild_member_roles_v2
                 WHERE guild_id = $1
                   AND role_key = $2",
                &[&guild_id, &normalized_role_key],
            )
            .await
            .map_err(|error| {
                UserDirectoryError::dependency_unavailable(format!(
                    "user_directory_role_member_count_query_failed:{error}"
                ))
            })?
            .get::<&str, i64>("member_count");

        transaction.commit().await.map_err(|error| {
            UserDirectoryError::dependency_unavailable(format!(
                "user_directory_transaction_commit_failed:{error}"
            ))
        })?;

        Ok(updated.to_directory_entry(member_count))
    }

    /// guild role を削除する。
    /// @param principal_id 認証済みprincipal_id
    /// @param guild_id 対象guild_id
    /// @param role_key 対象role_key
    /// @returns なし
    /// @throws UserDirectoryError 検証失敗/権限拒否/依存障害時
    async fn delete_guild_role(
        &self,
        _principal_id: PrincipalId,
        guild_id: i64,
        role_key: &str,
    ) -> Result<(), UserDirectoryError> {
        let normalized_role_key = self.normalize_role_key(role_key)?;
        let mut client = self.connect_owned_client().await?;
        let transaction = client.transaction().await.map_err(|error| {
            UserDirectoryError::dependency_unavailable(format!(
                "user_directory_transaction_start_failed:{error}"
            ))
        })?;

        if !self.has_guild(&transaction, guild_id).await? {
            return Err(UserDirectoryError::guild_not_found("guild_not_found"));
        }
        let current = self
            .get_role_state(&transaction, guild_id, &normalized_role_key)
            .await?;
        if current.is_system {
            return Err(UserDirectoryError::forbidden("system_role_delete_forbidden"));
        }

        let in_use = transaction
            .query_opt(
                "SELECT 1
                 FROM guild_member_roles_v2
                 WHERE guild_id = $1
                   AND role_key = $2
                 LIMIT 1",
                &[&guild_id, &normalized_role_key],
            )
            .await
            .map_err(|error| {
                UserDirectoryError::dependency_unavailable(format!(
                    "user_directory_role_usage_lookup_failed:{error}"
                ))
            })?;
        if in_use.is_some() {
            return Err(UserDirectoryError::validation("role_in_use"));
        }

        transaction
            .execute(
                "DELETE FROM guild_roles_v2
                 WHERE guild_id = $1
                   AND role_key = $2",
                &[&guild_id, &normalized_role_key],
            )
            .await
            .map_err(|error| {
                UserDirectoryError::dependency_unavailable(format!(
                    "user_directory_role_delete_failed:{error}"
                ))
            })?;
        self.enqueue_guild_role_event(&transaction, "delete", &current, guild_id)
            .await?;

        transaction.commit().await.map_err(|error| {
            UserDirectoryError::dependency_unavailable(format!(
                "user_directory_transaction_commit_failed:{error}"
            ))
        })?;

        Ok(())
    }

    /// guild custom role の順序を置換する。
    /// @param principal_id 認証済みprincipal_id
    /// @param guild_id 対象guild_id
    /// @param role_keys custom role の新順序
    /// @returns 更新後 role 一覧
    /// @throws UserDirectoryError 検証失敗/権限拒否/依存障害時
    async fn reorder_guild_roles(
        &self,
        _principal_id: PrincipalId,
        guild_id: i64,
        role_keys: Vec<String>,
    ) -> Result<Vec<GuildRoleDirectoryEntry>, UserDirectoryError> {
        let mut normalized_role_keys = Vec::with_capacity(role_keys.len());
        let mut seen = BTreeSet::new();
        for role_key in role_keys {
            let normalized = self.normalize_role_key(&role_key)?;
            if !seen.insert(normalized.clone()) {
                return Err(UserDirectoryError::validation("duplicate_role_key"));
            }
            normalized_role_keys.push(normalized);
        }

        let mut client = self.connect_owned_client().await?;
        let transaction = client.transaction().await.map_err(|error| {
            UserDirectoryError::dependency_unavailable(format!(
                "user_directory_transaction_start_failed:{error}"
            ))
        })?;

        if !self.has_guild(&transaction, guild_id).await? {
            return Err(UserDirectoryError::guild_not_found("guild_not_found"));
        }
        let current_roles = self.load_guild_roles(&transaction, guild_id).await?;
        let custom_roles = current_roles
            .iter()
            .filter(|role| !role.is_system)
            .cloned()
            .collect::<Vec<_>>();

        if custom_roles.len() != normalized_role_keys.len() {
            return Err(UserDirectoryError::validation(
                "role_reorder_custom_role_set_mismatch",
            ));
        }

        let current_custom_keys = custom_roles
            .iter()
            .map(|role| role.role_key.clone())
            .collect::<BTreeSet<_>>();
        let requested_custom_keys = normalized_role_keys
            .iter()
            .cloned()
            .collect::<BTreeSet<_>>();
        if current_custom_keys != requested_custom_keys {
            return Err(UserDirectoryError::validation(
                "role_reorder_custom_role_set_mismatch",
            ));
        }

        for (index, role_key) in normalized_role_keys.iter().enumerate() {
            let priority = FIRST_CUSTOM_ROLE_PRIORITY - index as i32;
            transaction
                .execute(
                    "UPDATE guild_roles_v2
                     SET priority = $3,
                         updated_at = now()
                     WHERE guild_id = $1
                       AND role_key = $2",
                    &[&guild_id, role_key, &priority],
                )
                .await
                .map_err(|error| {
                    UserDirectoryError::dependency_unavailable(format!(
                        "user_directory_role_reorder_failed:{error}"
                    ))
                })?;

            let updated = self.get_role_state(&transaction, guild_id, role_key).await?;
            self.enqueue_guild_role_event(&transaction, "upsert", &updated, guild_id)
                .await?;
        }

        let roles = self.load_guild_roles(&transaction, guild_id).await?;
        transaction.commit().await.map_err(|error| {
            UserDirectoryError::dependency_unavailable(format!(
                "user_directory_transaction_commit_failed:{error}"
            ))
        })?;
        Ok(roles)
    }

    /// guild member への role 割当を置換する。
    /// @param principal_id 認証済みprincipal_id
    /// @param guild_id 対象guild_id
    /// @param member_id 対象member_id
    /// @param role_keys 最終 role 一覧
    /// @returns 更新後 member
    /// @throws UserDirectoryError 検証失敗/権限拒否/依存障害時
    async fn replace_member_roles(
        &self,
        principal_id: PrincipalId,
        guild_id: i64,
        member_id: i64,
        role_keys: Vec<String>,
    ) -> Result<GuildMemberDirectoryEntry, UserDirectoryError> {
        let mut normalized_role_keys = BTreeSet::new();
        for role_key in role_keys {
            normalized_role_keys.insert(self.normalize_role_key(&role_key)?);
        }

        if !normalized_role_keys.contains(MEMBER_ROLE_KEY) {
            return Err(UserDirectoryError::validation("member_role_required"));
        }

        let mut client = self.connect_owned_client().await?;
        let transaction = client.transaction().await.map_err(|error| {
            UserDirectoryError::dependency_unavailable(format!(
                "user_directory_transaction_start_failed:{error}"
            ))
        })?;

        if !self.has_guild(&transaction, guild_id).await? {
            return Err(UserDirectoryError::guild_not_found("guild_not_found"));
        }
        self.ensure_target_member_exists(&transaction, guild_id, member_id)
            .await?;

        let role_rows = self.load_guild_roles(&transaction, guild_id).await?;
        let role_map = role_rows
            .iter()
            .map(|role| (role.role_key.clone(), role.clone()))
            .collect::<std::collections::HashMap<_, _>>();
        for role_key in &normalized_role_keys {
            if !role_map.contains_key(role_key) {
                return Err(UserDirectoryError::role_not_found("role_not_found"));
            }
        }

        let owner_row = transaction
            .query_one(
                "SELECT owner_id
                 FROM guilds
                 WHERE id = $1",
                &[&guild_id],
            )
            .await
            .map_err(|error| {
                UserDirectoryError::dependency_unavailable(format!(
                    "user_directory_guild_owner_query_failed:{error}"
                ))
            })?;
        let owner_id = owner_row.get::<&str, i64>("owner_id");
        let target_is_owner = owner_id == member_id;

        if target_is_owner && !normalized_role_keys.contains(OWNER_ROLE_KEY) {
            return Err(UserDirectoryError::forbidden("owner_role_required"));
        }
        if !target_is_owner && normalized_role_keys.contains(OWNER_ROLE_KEY) {
            return Err(UserDirectoryError::forbidden("owner_role_assignment_forbidden"));
        }

        let current_rows = transaction
            .query(
                "SELECT role_key
                 FROM guild_member_roles_v2
                 WHERE guild_id = $1
                   AND user_id = $2",
                &[&guild_id, &member_id],
            )
            .await
            .map_err(|error| {
                UserDirectoryError::dependency_unavailable(format!(
                    "user_directory_member_roles_query_failed:{error}"
                ))
            })?;
        let current_role_keys = current_rows
            .into_iter()
            .map(|row| row.get::<&str, String>("role_key"))
            .collect::<BTreeSet<_>>();

        for role_key in current_role_keys.difference(&normalized_role_keys) {
            transaction
                .execute(
                    "DELETE FROM guild_member_roles_v2
                     WHERE guild_id = $1
                       AND user_id = $2
                       AND role_key = $3",
                    &[&guild_id, &member_id, role_key],
                )
                .await
                .map_err(|error| {
                    UserDirectoryError::dependency_unavailable(format!(
                        "user_directory_member_role_delete_failed:{error}"
                    ))
                })?;
            self.enqueue_guild_member_role_event(
                &transaction,
                "delete",
                guild_id,
                member_id,
                role_key,
            )
            .await?;
        }

        for role_key in normalized_role_keys.difference(&current_role_keys) {
            transaction
                .execute(
                    "INSERT INTO guild_member_roles_v2 (
                        guild_id,
                        user_id,
                        role_key,
                        assigned_by
                     ) VALUES ($1, $2, $3, $4)",
                    &[&guild_id, &member_id, role_key, &principal_id.0],
                )
                .await
                .map_err(|error| {
                    UserDirectoryError::dependency_unavailable(format!(
                        "user_directory_member_role_insert_failed:{error}"
                    ))
                })?;
            self.enqueue_guild_member_role_event(
                &transaction,
                "upsert",
                guild_id,
                member_id,
                role_key,
            )
            .await?;
        }

        let member = self
            .load_guild_member_entry(&transaction, guild_id, member_id)
            .await?;
        transaction.commit().await.map_err(|error| {
            UserDirectoryError::dependency_unavailable(format!(
                "user_directory_transaction_commit_failed:{error}"
            ))
        })?;
        Ok(member)
    }

    /// channel permission を返す。
    /// @param principal_id 認証済みprincipal_id
    /// @param guild_id 対象guild_id
    /// @param channel_id 対象channel_id
    /// @returns permission 一覧
    /// @throws UserDirectoryError 検証失敗/権限拒否/依存障害時
    async fn get_channel_permissions(
        &self,
        _principal_id: PrincipalId,
        guild_id: i64,
        channel_id: i64,
    ) -> Result<ChannelPermissionDirectoryEntry, UserDirectoryError> {
        let client = self.select_client().await?;
        self.ensure_target_channel_exists(&*client, guild_id, channel_id)
            .await?;
        self.load_channel_permissions(&*client, guild_id, channel_id)
            .await
    }

    /// channel permission を置換する。
    /// @param principal_id 認証済みprincipal_id
    /// @param guild_id 対象guild_id
    /// @param channel_id 対象channel_id
    /// @param input 最終 override 一覧
    /// @returns 更新後 permission と invalidation 用情報
    /// @throws UserDirectoryError 検証失敗/権限拒否/依存障害時
    async fn replace_channel_permissions(
        &self,
        _principal_id: PrincipalId,
        guild_id: i64,
        channel_id: i64,
        input: ReplaceChannelPermissionsInput,
    ) -> Result<ChannelPermissionUpdateResult, UserDirectoryError> {
        let mut normalized_role_inputs = std::collections::HashMap::<String, (Option<bool>, Option<bool>)>::new();
        for override_input in input.role_overrides {
            let role_key = self.normalize_role_key(&override_input.role_key)?;
            if normalized_role_inputs
                .insert(
                    role_key,
                    (
                        override_input.can_view.as_option_bool(),
                        override_input.can_post.as_option_bool(),
                    ),
                )
                .is_some()
            {
                return Err(UserDirectoryError::validation("duplicate_role_override_subject"));
            }
        }

        let mut normalized_user_inputs = std::collections::HashMap::<i64, (Option<bool>, Option<bool>)>::new();
        for override_input in input.user_overrides {
            if override_input.user_id <= 0 {
                return Err(UserDirectoryError::validation("user_id_invalid"));
            }
            if normalized_user_inputs
                .insert(
                    override_input.user_id,
                    (
                        override_input.can_view.as_option_bool(),
                        override_input.can_post.as_option_bool(),
                    ),
                )
                .is_some()
            {
                return Err(UserDirectoryError::validation("duplicate_user_override_subject"));
            }
        }

        let mut client = self.connect_owned_client().await?;
        let transaction = client.transaction().await.map_err(|error| {
            UserDirectoryError::dependency_unavailable(format!(
                "user_directory_transaction_start_failed:{error}"
            ))
        })?;

        self.ensure_target_channel_exists(&transaction, guild_id, channel_id)
            .await?;

        for role_key in normalized_role_inputs.keys() {
            self.get_role_state(&transaction, guild_id, role_key).await?;
        }
        for user_id in normalized_user_inputs.keys() {
            self.ensure_target_member_exists(&transaction, guild_id, *user_id)
                .await?;
        }

        let current_role_rows = transaction
            .query(
                "SELECT role_key, can_view, can_post
                 FROM channel_role_permission_overrides_v2
                 WHERE guild_id = $1
                   AND channel_id = $2",
                &[&guild_id, &channel_id],
            )
            .await
            .map_err(|error| {
                UserDirectoryError::dependency_unavailable(format!(
                    "user_directory_channel_role_override_query_failed:{error}"
                ))
            })?;
        let current_role_map = current_role_rows
            .into_iter()
            .map(|row| {
                (
                    row.get::<&str, String>("role_key"),
                    (
                        row.get::<&str, Option<bool>>("can_view"),
                        row.get::<&str, Option<bool>>("can_post"),
                    ),
                )
            })
            .collect::<std::collections::HashMap<_, _>>();

        let current_user_rows = transaction
            .query(
                "SELECT user_id, can_view, can_post
                 FROM channel_user_permission_overrides_v2
                 WHERE guild_id = $1
                   AND channel_id = $2",
                &[&guild_id, &channel_id],
            )
            .await
            .map_err(|error| {
                UserDirectoryError::dependency_unavailable(format!(
                    "user_directory_channel_user_override_query_failed:{error}"
                ))
            })?;
        let current_user_map = current_user_rows
            .into_iter()
            .map(|row| {
                (
                    row.get::<&str, i64>("user_id"),
                    (
                        row.get::<&str, Option<bool>>("can_view"),
                        row.get::<&str, Option<bool>>("can_post"),
                    ),
                )
            })
            .collect::<std::collections::HashMap<_, _>>();

        let mut changed_role_overrides = false;
        let mut changed_user_ids = BTreeSet::new();

        let current_role_keys = current_role_map.keys().cloned().collect::<BTreeSet<_>>();
        let requested_role_keys = normalized_role_inputs.keys().cloned().collect::<BTreeSet<_>>();
        for role_key in current_role_keys.difference(&requested_role_keys) {
            transaction
                .execute(
                    "DELETE FROM channel_role_permission_overrides_v2
                     WHERE guild_id = $1
                       AND channel_id = $2
                       AND role_key = $3",
                    &[&guild_id, &channel_id, role_key],
                )
                .await
                .map_err(|error| {
                    UserDirectoryError::dependency_unavailable(format!(
                        "user_directory_channel_role_override_delete_failed:{error}"
                    ))
                })?;
            self.enqueue_channel_role_override_event(
                &transaction,
                "delete",
                guild_id,
                channel_id,
                role_key,
                (None, None),
            )
            .await?;
            changed_role_overrides = true;
        }

        for (role_key, values) in &normalized_role_inputs {
            if values.0.is_none() && values.1.is_none() {
                if current_role_map.contains_key(role_key) {
                    transaction
                        .execute(
                            "DELETE FROM channel_role_permission_overrides_v2
                             WHERE guild_id = $1
                               AND channel_id = $2
                               AND role_key = $3",
                            &[&guild_id, &channel_id, role_key],
                        )
                        .await
                        .map_err(|error| {
                            UserDirectoryError::dependency_unavailable(format!(
                                "user_directory_channel_role_override_delete_failed:{error}"
                            ))
                        })?;
                    self.enqueue_channel_role_override_event(
                        &transaction,
                        "delete",
                        guild_id,
                        channel_id,
                        role_key,
                        (None, None),
                    )
                    .await?;
                    changed_role_overrides = true;
                }
                continue;
            }

            let needs_write = current_role_map.get(role_key) != Some(values);
            if !needs_write {
                continue;
            }

            transaction
                .execute(
                    "INSERT INTO channel_role_permission_overrides_v2 (
                        channel_id,
                        guild_id,
                        role_key,
                        can_view,
                        can_post
                     ) VALUES ($1, $2, $3, $4, $5)
                     ON CONFLICT (channel_id, role_key)
                     DO UPDATE SET
                        can_view = EXCLUDED.can_view,
                        can_post = EXCLUDED.can_post,
                        updated_at = now()",
                    &[&channel_id, &guild_id, role_key, &values.0, &values.1],
                )
                .await
                .map_err(|error| {
                    UserDirectoryError::dependency_unavailable(format!(
                        "user_directory_channel_role_override_upsert_failed:{error}"
                    ))
                })?;
            self.enqueue_channel_role_override_event(
                &transaction,
                "upsert",
                guild_id,
                channel_id,
                role_key,
                *values,
            )
            .await?;
            changed_role_overrides = true;
        }

        let current_user_ids = current_user_map.keys().cloned().collect::<BTreeSet<_>>();
        let requested_user_ids = normalized_user_inputs.keys().cloned().collect::<BTreeSet<_>>();
        for user_id in current_user_ids.difference(&requested_user_ids) {
            transaction
                .execute(
                    "DELETE FROM channel_user_permission_overrides_v2
                     WHERE guild_id = $1
                       AND channel_id = $2
                       AND user_id = $3",
                    &[&guild_id, &channel_id, user_id],
                )
                .await
                .map_err(|error| {
                    UserDirectoryError::dependency_unavailable(format!(
                        "user_directory_channel_user_override_delete_failed:{error}"
                    ))
                })?;
            self.enqueue_channel_user_override_event(
                &transaction,
                "delete",
                guild_id,
                channel_id,
                *user_id,
                (None, None),
            )
            .await?;
            changed_user_ids.insert(*user_id);
        }

        for (user_id, values) in &normalized_user_inputs {
            if values.0.is_none() && values.1.is_none() {
                if current_user_map.contains_key(user_id) {
                    transaction
                        .execute(
                            "DELETE FROM channel_user_permission_overrides_v2
                             WHERE guild_id = $1
                               AND channel_id = $2
                               AND user_id = $3",
                            &[&guild_id, &channel_id, user_id],
                        )
                        .await
                        .map_err(|error| {
                            UserDirectoryError::dependency_unavailable(format!(
                                "user_directory_channel_user_override_delete_failed:{error}"
                            ))
                        })?;
                    self.enqueue_channel_user_override_event(
                        &transaction,
                        "delete",
                        guild_id,
                        channel_id,
                        *user_id,
                        (None, None),
                    )
                    .await?;
                    changed_user_ids.insert(*user_id);
                }
                continue;
            }

            let needs_write = current_user_map.get(user_id) != Some(values);
            if !needs_write {
                continue;
            }

            transaction
                .execute(
                    "INSERT INTO channel_user_permission_overrides_v2 (
                        channel_id,
                        guild_id,
                        user_id,
                        can_view,
                        can_post
                     ) VALUES ($1, $2, $3, $4, $5)
                     ON CONFLICT (channel_id, user_id)
                     DO UPDATE SET
                        can_view = EXCLUDED.can_view,
                        can_post = EXCLUDED.can_post,
                        updated_at = now()",
                    &[&channel_id, &guild_id, user_id, &values.0, &values.1],
                )
                .await
                .map_err(|error| {
                    UserDirectoryError::dependency_unavailable(format!(
                        "user_directory_channel_user_override_upsert_failed:{error}"
                    ))
                })?;
            self.enqueue_channel_user_override_event(
                &transaction,
                "upsert",
                guild_id,
                channel_id,
                *user_id,
                *values,
            )
            .await?;
            changed_user_ids.insert(*user_id);
        }

        let permissions = self
            .load_channel_permissions(&transaction, guild_id, channel_id)
            .await?;
        transaction.commit().await.map_err(|error| {
            UserDirectoryError::dependency_unavailable(format!(
                "user_directory_transaction_commit_failed:{error}"
            ))
        })?;

        Ok(ChannelPermissionUpdateResult {
            permissions,
            changed_role_overrides,
            changed_user_ids: changed_user_ids.into_iter().collect(),
        })
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
