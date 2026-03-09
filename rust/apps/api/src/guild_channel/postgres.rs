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
    const CREATE_GUILD_SQL: &str = "WITH created_guild AS (
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
                    INSERT INTO guild_roles_v2 (
                      guild_id,
                      role_key,
                      name,
                      priority,
                      allow_view,
                      allow_post,
                      allow_manage,
                      is_system
                    )
                    SELECT
                      id,
                      role_key,
                      role_name,
                      priority,
                      TRUE,
                      TRUE,
                      allow_manage,
                      TRUE
                    FROM created_guild
                    CROSS JOIN (
                      VALUES
                        ('owner'::text, 'Owner'::text, 300::int, TRUE),
                        ('admin'::text, 'Admin'::text, 200::int, TRUE),
                        ('member'::text, 'Member'::text, 100::int, FALSE)
                    ) AS roles(role_key, role_name, priority, allow_manage)
                    ON CONFLICT (guild_id, role_key) DO UPDATE
                    SET
                      name = EXCLUDED.name,
                      priority = EXCLUDED.priority,
                      allow_view = EXCLUDED.allow_view,
                      allow_post = EXCLUDED.allow_post,
                      allow_manage = EXCLUDED.allow_manage,
                      is_system = EXCLUDED.is_system
                 ),
                 owner_role AS (
                    INSERT INTO guild_member_roles_v2 (guild_id, user_id, role_key)
                    SELECT id, $2, 'owner'::text FROM created_guild
                    ON CONFLICT (guild_id, user_id, role_key) DO NOTHING
                 )
                 SELECT
                    id AS guild_id,
                    name,
                    icon_key,
                    owner_id
                 FROM created_guild";
    const CREATE_GUILD_CHANNEL_SQL: &str = "WITH manageable AS (
                    SELECT gm.guild_id
                    FROM guild_members gm
                    WHERE gm.guild_id = $1
                      AND gm.user_id = $4
                      AND EXISTS (
                        SELECT 1
                        FROM guild_member_roles_v2 gmr
                        JOIN guild_roles_v2 gr
                          ON gr.guild_id = gmr.guild_id
                         AND gr.role_key = gmr.role_key
                        WHERE gmr.guild_id = gm.guild_id
                          AND gmr.user_id = $4
                          AND gmr.role_key IN ('owner', 'admin')
                          AND gr.allow_manage = TRUE
                      )
                    FOR KEY SHARE
                 ),
                 validated_parent AS (
                    SELECT
                      c.id AS parent_channel_id,
                      c.guild_id
                    FROM channels c
                    JOIN manageable m
                      ON m.guild_id = c.guild_id
                    WHERE c.id = $3
                      AND c.type = 'guild_category'
                 ),
                 inserted_channel AS (
                    INSERT INTO channels (type, guild_id, name, created_by)
                    SELECT
                      CASE $2
                        WHEN 'guild_text' THEN 'guild_text'::channel_type
                        WHEN 'guild_category' THEN 'guild_category'::channel_type
                      END,
                      m.guild_id,
                      $5,
                      $4
                    FROM manageable m
                    WHERE ($2 = 'guild_category' AND $3 IS NULL)
                       OR ($2 = 'guild_text' AND $3 IS NULL)
                       OR ($2 = 'guild_text' AND EXISTS (SELECT 1 FROM validated_parent))
                    RETURNING
                      id AS channel_id,
                      guild_id,
                      type::text AS channel_type,
                      name,
                      created_at
                 ),
                 inserted_hierarchy AS (
                    INSERT INTO channel_hierarchies_v2 (
                      child_channel_id,
                      guild_id,
                      parent_channel_id,
                      hierarchy_kind,
                      position
                    )
                    SELECT
                      ic.channel_id,
                      ic.guild_id,
                      vp.parent_channel_id,
                      'category_child'::channel_hierarchy_kind,
                      COALESCE((
                        SELECT MAX(existing.position) + 1
                        FROM channel_hierarchies_v2 existing
                        WHERE existing.parent_channel_id = vp.parent_channel_id
                          AND existing.hierarchy_kind = 'category_child'
                      ), 0)
                    FROM inserted_channel ic
                    JOIN validated_parent vp
                      ON $3 IS NOT NULL
                    RETURNING parent_channel_id, position
                 )
                 SELECT
                    ic.channel_id,
                    ic.guild_id,
                    ic.channel_type,
                    ic.name,
                    (SELECT parent_channel_id FROM inserted_hierarchy LIMIT 1) AS parent_channel_id,
                    COALESCE((SELECT position FROM inserted_hierarchy LIMIT 1), 0)::INT AS position,
                    to_char(ic.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS created_at
                 FROM inserted_channel ic";
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
                    c.type::text AS channel_type,
                    c.name,
                    h.parent_channel_id,
                    CASE
                      WHEN c.id IS NULL THEN NULL
                      WHEN h.position IS NOT NULL THEN h.position
                      ELSE GREATEST(
                        ROW_NUMBER() OVER (
                          PARTITION BY (h.parent_channel_id IS NOT NULL)
                          ORDER BY c.created_at ASC, c.id ASC
                        ) - 1,
                        0
                      )::INT
                    END AS position,
                    to_char(c.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS created_at_text
                 FROM member m
                 LEFT JOIN channels c
                   ON c.guild_id = m.guild_id
                  AND c.type IN ('guild_text', 'guild_category')
                 LEFT JOIN channel_hierarchies_v2 h
                   ON h.child_channel_id = c.id
                  AND h.hierarchy_kind = 'category_child'
                 ORDER BY c.created_at ASC NULLS LAST, c.id ASC NULLS LAST";
    const GET_GUILD_CHANNEL_SUMMARY_SQL: &str = "WITH member AS (
                    SELECT gm.guild_id
                    FROM guild_members gm
                    WHERE gm.guild_id = $1
                      AND gm.user_id = $3
                    FOR KEY SHARE
                 )
                 SELECT
                    c.id AS channel_id,
                    c.guild_id,
                    c.type::text AS channel_type,
                    c.name,
                    h.parent_channel_id,
                    COALESCE(h.position, 0)::INT AS position,
                    to_char(c.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS created_at_text
                 FROM member m
                 JOIN channels c
                   ON c.guild_id = m.guild_id
                  AND c.id = $2
                  AND c.type IN ('guild_text', 'guild_category')
                 LEFT JOIN channel_hierarchies_v2 h
                   ON h.child_channel_id = c.id
                  AND h.hierarchy_kind = 'category_child'";
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
    const DELETE_GUILD_SQL: &str = "WITH target AS (
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
                 deleted AS (
                    DELETE FROM guilds g
                    USING actor a
                    WHERE g.id = a.guild_id
                      AND (a.is_owner OR a.can_manage)
                    RETURNING g.id AS guild_id
                 )
                 SELECT guild_id FROM deleted";
    const UPDATE_GUILD_CHANNEL_SQL: &str = "WITH editable AS (
                    SELECT
                       c.id AS channel_id,
                       c.guild_id
                    FROM channels c
                    WHERE c.id = $1
                      AND c.type IN ('guild_text', 'guild_category')
                      AND EXISTS (
                        SELECT 1
                        FROM guild_members gm
                        WHERE gm.guild_id = c.guild_id
                          AND gm.user_id = $2
                        FOR KEY SHARE
                      )
                      AND EXISTS (
                        SELECT 1
                        FROM guild_member_roles_v2 gmr
                        JOIN guild_roles_v2 gr
                          ON gr.guild_id = gmr.guild_id
                         AND gr.role_key = gmr.role_key
                        WHERE gmr.guild_id = c.guild_id
                          AND gmr.user_id = $2
                          AND gmr.role_key IN ('owner', 'admin')
                          AND gr.allow_manage = TRUE
                      )
                 )
                 UPDATE channels c
                 SET
                    name = $3,
                    updated_at = now()
                 FROM editable e
                 LEFT JOIN channel_hierarchies_v2 h
                   ON h.child_channel_id = e.channel_id
                  AND h.hierarchy_kind = 'category_child'
                 WHERE c.id = e.channel_id
                   AND c.guild_id = e.guild_id
                 RETURNING
                    c.id AS channel_id,
                    c.guild_id,
                    c.type::text AS channel_type,
                    c.name,
                    h.parent_channel_id,
                    COALESCE(h.position, 0)::INT AS position,
                    to_char(c.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS created_at";
    const DELETE_GUILD_CHANNEL_SQL: &str = "WITH deletable AS (
                    SELECT
                       c.id AS channel_id,
                       c.guild_id,
                       c.type::text AS channel_type
                    FROM channels c
                    WHERE c.id = $1
                      AND c.type IN ('guild_text', 'guild_category')
                      AND EXISTS (
                        SELECT 1
                        FROM guild_members gm
                        WHERE gm.guild_id = c.guild_id
                          AND gm.user_id = $2
                        FOR KEY SHARE
                      )
                      AND EXISTS (
                        SELECT 1
                        FROM guild_member_roles_v2 gmr
                        JOIN guild_roles_v2 gr
                          ON gr.guild_id = gmr.guild_id
                         AND gr.role_key = gmr.role_key
                        WHERE gmr.guild_id = c.guild_id
                          AND gmr.user_id = $2
                          AND gmr.role_key IN ('owner', 'admin')
                          AND gr.allow_manage = TRUE
                      )
                 ),
                 deleted_children AS (
                    DELETE FROM channels c
                    USING channel_hierarchies_v2 h, deletable d
                    WHERE d.channel_type = 'guild_category'
                      AND h.parent_channel_id = d.channel_id
                      AND h.hierarchy_kind = 'category_child'
                      AND c.id = h.child_channel_id
                    RETURNING c.id
                 ),
                 deleted_target AS (
                    DELETE FROM channels c
                    USING deletable d
                    WHERE c.id = d.channel_id
                      AND c.guild_id = d.guild_id
                    RETURNING c.id AS channel_id
                 )
                 SELECT channel_id FROM deleted_target";

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

    /// channelの所属guild_idを取得する。
    /// @param client Postgresクライアント
    /// @param channel_id 対象channel_id
    /// @returns channelが存在する場合は `Some(guild_id)`
    /// @throws GuildChannelError 依存障害時
    async fn find_channel_guild_id(
        &self,
        client: &tokio_postgres::Client,
        channel_id: i64,
    ) -> Result<Option<i64>, GuildChannelError> {
        match client
            .query_opt(
                "SELECT guild_id
                 FROM channels
                 WHERE id = $1
                   AND type IN ('guild_text', 'guild_category')
                   AND guild_id IS NOT NULL",
                &[&channel_id],
            )
            .await
        {
            Ok(Some(row)) => Ok(Some(row.get::<&str, i64>("guild_id"))),
            Ok(None) => Ok(None),
            Err(error) => Err(self.map_read_error("channel_lookup_failed", error).await),
        }
    }

    /// channelの所属guildと種別を取得する。
    /// @param client Postgresクライアント
    /// @param channel_id 対象channel_id
    /// @returns channelが存在する場合は `Some((guild_id, kind))`
    /// @throws GuildChannelError 依存障害時
    async fn find_channel_scope(
        &self,
        client: &tokio_postgres::Client,
        channel_id: i64,
    ) -> Result<Option<(i64, ChannelKind)>, GuildChannelError> {
        match client
            .query_opt(
                "SELECT guild_id, type::text AS channel_type
                 FROM channels
                 WHERE id = $1
                   AND type IN ('guild_text', 'guild_category')
                   AND guild_id IS NOT NULL",
                &[&channel_id],
            )
            .await
        {
            Ok(Some(row)) => Ok(Some((
                row.get::<&str, i64>("guild_id"),
                ChannelKind::parse(&row.get::<&str, String>("channel_type"))?,
            ))),
            Ok(None) => Ok(None),
            Err(error) => Err(self.map_read_error("channel_scope_lookup_failed", error).await),
        }
    }

    /// guildメンバー所属を確認する。
    /// @param client Postgresクライアント
    /// @param guild_id 対象guild_id
    /// @param user_id 対象user_id
    /// @returns メンバー所属がある場合は `true`
    /// @throws GuildChannelError 依存障害時
    async fn has_guild_membership(
        &self,
        client: &tokio_postgres::Client,
        guild_id: i64,
        user_id: i64,
    ) -> Result<bool, GuildChannelError> {
        match client
            .query_opt(
                "SELECT 1
                 FROM guild_members
                 WHERE guild_id = $1
                   AND user_id = $2",
                &[&guild_id, &user_id],
            )
            .await
        {
            Ok(row) => Ok(row.is_some()),
            Err(error) => Err(self.map_read_error("guild_membership_lookup_failed", error).await),
        }
    }

    /// guildの管理権限を確認する。
    /// @param client Postgresクライアント
    /// @param guild_id 対象guild_id
    /// @param user_id 対象user_id
    /// @returns owner/admin管理権限を持つ場合は `true`
    /// @throws GuildChannelError 依存障害時
    async fn has_guild_manage_role(
        &self,
        client: &tokio_postgres::Client,
        guild_id: i64,
        user_id: i64,
    ) -> Result<bool, GuildChannelError> {
        match client
            .query_opt(
                "SELECT 1
                 FROM guild_member_roles_v2 gmr
                 JOIN guild_roles_v2 gr
                   ON gr.guild_id = gmr.guild_id
                  AND gr.role_key = gmr.role_key
                 WHERE gmr.guild_id = $1
                   AND gmr.user_id = $2
                   AND gmr.role_key IN ('owner', 'admin')
                   AND gr.allow_manage = TRUE",
                &[&guild_id, &user_id],
            )
            .await
        {
            Ok(row) => Ok(row.is_some()),
            Err(error) => Err(self.map_read_error("guild_manage_role_lookup_failed", error).await),
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
            .query_one(Self::CREATE_GUILD_SQL, &[&normalized_name, &principal_id.0])
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

    /// guildを削除する。
    /// @param principal_id 削除主体
    /// @param guild_id 対象guild_id
    /// @returns なし
    /// @throws GuildChannelError 非権限/未存在/依存障害時
    async fn delete_guild(
        &self,
        principal_id: PrincipalId,
        guild_id: i64,
    ) -> Result<(), GuildChannelError> {
        let client = self.select_client().await?;

        match client
            .query_opt(Self::DELETE_GUILD_SQL, &[&guild_id, &principal_id.0])
            .await
        {
            Ok(Some(_)) => Ok(()),
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
                Err(GuildChannelError::dependency_unavailable(
                    "guild_delete_rejected_without_reason",
                ))
            }
            Err(error) => {
                self.invalidate_pool().await;
                Err(Self::map_write_error("guild_delete_query_failed", error))
            }
        }
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

        let mut channels = Vec::with_capacity(rows.len());
        for row in rows {
            let Some(channel_id) = row.get::<&str, Option<i64>>("channel_id") else {
                continue;
            };
            let Some(channel_type) = row.get::<&str, Option<String>>("channel_type") else {
                continue;
            };
            let Some(name) = row.get::<&str, Option<String>>("name") else {
                continue;
            };
            let Some(position) = row.get::<&str, Option<i32>>("position") else {
                continue;
            };
            let Some(created_at) = row.get::<&str, Option<String>>("created_at_text") else {
                continue;
            };

            channels.push(ChannelSummary {
                channel_id,
                guild_id: row.get::<&str, i64>("guild_id"),
                kind: ChannelKind::parse(&channel_type)?,
                name,
                parent_id: row.get::<&str, Option<i64>>("parent_channel_id"),
                position,
                created_at,
            });
        }

        Ok(channels)
    }

    /// guild配下のchannel要約を1件返す。
    /// @param principal_id 認証済みprincipal_id
    /// @param guild_id 対象guild_id
    /// @param channel_id 対象channel_id
    /// @returns channel要約
    /// @throws GuildChannelError 非メンバー/未存在/依存障害時
    async fn get_guild_channel_summary(
        &self,
        principal_id: PrincipalId,
        guild_id: i64,
        channel_id: i64,
    ) -> Result<ChannelSummary, GuildChannelError> {
        let client = self.select_client().await?;
        let row = match client
            .query_opt(
                Self::GET_GUILD_CHANNEL_SUMMARY_SQL,
                &[&guild_id, &channel_id, &principal_id.0],
            )
            .await
        {
            Ok(Some(row)) => row,
            Ok(None) => {
                if !self.has_guild(&client, guild_id).await? {
                    return Err(GuildChannelError::not_found("guild_not_found"));
                }
                if !self
                    .has_guild_membership(&client, guild_id, principal_id.0)
                    .await?
                {
                    return Err(GuildChannelError::forbidden("guild_membership_required"));
                }
                return Err(GuildChannelError::channel_not_found("channel_not_found"));
            }
            Err(error) => return Err(self.map_read_error("channel_get_query_failed", error).await),
        };

        Ok(ChannelSummary {
            channel_id: row.get::<&str, i64>("channel_id"),
            guild_id: row.get::<&str, i64>("guild_id"),
            kind: ChannelKind::parse(&row.get::<&str, String>("channel_type"))?,
            name: row.get::<&str, String>("name"),
            parent_id: row.get::<&str, Option<i64>>("parent_channel_id"),
            position: row.get::<&str, i32>("position"),
            created_at: row.get::<&str, String>("created_at_text"),
        })
    }

    /// guild配下へchannelを作成する。
    /// @param principal_id 作成主体
    /// @param guild_id 対象guild_id
    /// @param input channel作成入力
    /// @returns 作成結果
    /// @throws GuildChannelError 入力不正/非メンバー/未存在/依存障害時
    async fn create_guild_channel(
        &self,
        principal_id: PrincipalId,
        guild_id: i64,
        input: CreateChannelInput,
    ) -> Result<CreatedChannel, GuildChannelError> {
        let normalized_input = normalize_channel_create_input(input)?;
        if matches!(normalized_input.kind, ChannelKind::GuildCategory) && normalized_input.parent_id.is_some()
        {
            return Err(GuildChannelError::validation("category_parent_not_allowed"));
        }
        let client = self.select_client().await?;

        let row = match client
            .query_opt(
                Self::CREATE_GUILD_CHANNEL_SQL,
                &[
                    &guild_id,
                    &normalized_input.kind.as_db_str(),
                    &normalized_input.parent_id,
                    &principal_id.0,
                    &normalized_input.name,
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
                    .has_guild_membership(&client, guild_id, principal_id.0)
                    .await?
                {
                    return Err(GuildChannelError::forbidden("guild_membership_required"));
                }
                if !self.has_manage_permission(&client, principal_id, guild_id).await? {
                    return Err(GuildChannelError::forbidden("channel_manage_permission_required"));
                }
                if let Some(parent_id) = normalized_input.parent_id {
                    let Some((parent_guild_id, parent_kind)) =
                        self.find_channel_scope(&client, parent_id).await?
                    else {
                        return Err(GuildChannelError::channel_not_found("parent_channel_not_found"));
                    };
                    if parent_guild_id != guild_id {
                        return Err(GuildChannelError::validation("parent_channel_cross_guild"));
                    }
                    if parent_kind != ChannelKind::GuildCategory {
                        return Err(GuildChannelError::validation("parent_channel_must_be_category"));
                    }
                }
                return Err(GuildChannelError::dependency_unavailable(
                    "channel_create_rejected_without_reason",
                ));
            }
            Err(error) => {
                self.invalidate_pool().await;
                return Err(Self::map_write_error("channel_create_insert_failed", error));
            }
        };

        Ok(CreatedChannel {
            channel_id: row.get::<&str, i64>("channel_id"),
            guild_id: row.get::<&str, i64>("guild_id"),
            kind: ChannelKind::parse(&row.get::<&str, String>("channel_type"))?,
            name: row.get::<&str, String>("name"),
            parent_id: row.get::<&str, Option<i64>>("parent_channel_id"),
            position: row.get::<&str, i32>("position"),
            created_at: row.get::<&str, String>("created_at"),
        })
    }

    /// channelを更新する。
    /// @param principal_id 更新主体
    /// @param channel_id 対象channel_id
    /// @param patch 更新入力
    /// @returns 更新結果
    /// @throws GuildChannelError 入力不正/境界違反/未存在/依存障害時
    async fn update_guild_channel(
        &self,
        principal_id: PrincipalId,
        channel_id: i64,
        patch: ChannelPatchInput,
    ) -> Result<ChannelSummary, GuildChannelError> {
        let normalized_name = normalize_channel_patch_input(patch)?;
        let client = self.select_client().await?;

        let row = match client
            .query_opt(
                Self::UPDATE_GUILD_CHANNEL_SQL,
                &[&channel_id, &principal_id.0, &normalized_name],
            )
            .await
        {
            Ok(Some(row)) => row,
            Ok(None) => {
                let Some(guild_id) = self.find_channel_guild_id(&client, channel_id).await? else {
                    return Err(GuildChannelError::channel_not_found("channel_not_found"));
                };

                if !self
                    .has_guild_membership(&client, guild_id, principal_id.0)
                    .await?
                {
                    return Err(GuildChannelError::forbidden("guild_membership_required"));
                }

                if !self
                    .has_guild_manage_role(&client, guild_id, principal_id.0)
                    .await?
                {
                    return Err(GuildChannelError::forbidden("channel_manage_permission_required"));
                }

                return Err(GuildChannelError::channel_not_found("channel_not_found"));
            }
            Err(error) => {
                self.invalidate_pool().await;
                return Err(Self::map_write_error("channel_update_query_failed", error));
            }
        };

        Ok(ChannelSummary {
            channel_id: row.get::<&str, i64>("channel_id"),
            guild_id: row.get::<&str, i64>("guild_id"),
            kind: ChannelKind::parse(&row.get::<&str, String>("channel_type"))?,
            name: row.get::<&str, String>("name"),
            parent_id: row.get::<&str, Option<i64>>("parent_channel_id"),
            position: row.get::<&str, i32>("position"),
            created_at: row.get::<&str, String>("created_at"),
        })
    }

    /// channelを削除する。
    /// @param principal_id 削除主体
    /// @param channel_id 対象channel_id
    /// @returns なし
    /// @throws GuildChannelError 境界違反/未存在/依存障害時
    async fn delete_guild_channel(
        &self,
        principal_id: PrincipalId,
        channel_id: i64,
    ) -> Result<(), GuildChannelError> {
        let client = self.select_client().await?;

        match client
            .query_opt(Self::DELETE_GUILD_CHANNEL_SQL, &[&channel_id, &principal_id.0])
            .await
        {
            Ok(Some(_)) => Ok(()),
            Ok(None) => {
                let Some(guild_id) = self.find_channel_guild_id(&client, channel_id).await? else {
                    return Err(GuildChannelError::channel_not_found("channel_not_found"));
                };

                if !self
                    .has_guild_membership(&client, guild_id, principal_id.0)
                    .await?
                {
                    return Err(GuildChannelError::forbidden("guild_membership_required"));
                }

                if !self
                    .has_guild_manage_role(&client, guild_id, principal_id.0)
                    .await?
                {
                    return Err(GuildChannelError::forbidden("channel_manage_permission_required"));
                }

                Err(GuildChannelError::channel_not_found("channel_not_found"))
            }
            Err(error) => {
                self.invalidate_pool().await;
                Err(Self::map_write_error("channel_delete_query_failed", error))
            }
        }
    }
}
