/// Postgres-backed invite サービスを表現する。
#[derive(Clone)]
pub struct PostgresInviteService {
    database_url: Arc<str>,
    allow_postgres_notls: bool,
    clients: Arc<RwLock<Vec<Arc<tokio_postgres::Client>>>>,
    next_index: Arc<AtomicU64>,
    pool_size: usize,
}

impl PostgresInviteService {
    const DEFAULT_POOL_SIZE: usize = 4;
    const MAX_POOL_SIZE: usize = 100;
    const LIST_INVITES_SQL: &str = "WITH manageable AS (
                    SELECT gm.guild_id
                    FROM guild_members gm
                    WHERE gm.guild_id = $1
                      AND gm.user_id = $2
                      AND (
                        EXISTS (
                          SELECT 1
                          FROM guilds g
                          WHERE g.id = gm.guild_id
                            AND g.owner_id = $2
                        )
                        OR EXISTS (
                          SELECT 1
                          FROM guild_member_roles_v2 gmr
                          JOIN guild_roles_v2 gr
                            ON gr.guild_id = gmr.guild_id
                           AND gr.role_key = gmr.role_key
                          WHERE gmr.guild_id = gm.guild_id
                            AND gmr.user_id = $2
                            AND gr.allow_manage = TRUE
                        )
                      )
                    FOR KEY SHARE
                 )
                 SELECT
                    i.code AS invite_code,
                    i.channel_id,
                    c.name AS channel_name,
                    i.created_by,
                    u.display_name AS creator_display_name,
                    to_char(i.expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS expires_at_text,
                    i.uses,
                    i.max_uses,
                    to_char(i.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS created_at_text
                 FROM invites i
                 JOIN manageable m
                   ON m.guild_id = i.guild_id
                 LEFT JOIN channels c
                   ON c.id = i.channel_id
                 LEFT JOIN users u
                   ON u.id = i.created_by
                 WHERE i.guild_id = $1
                   AND ($3::bigint IS NULL OR i.channel_id = $3)
                   AND i.is_disabled = FALSE
                   AND (i.expires_at IS NULL OR i.expires_at >= now())
                   AND (i.max_uses IS NULL OR i.uses < i.max_uses)
                 ORDER BY i.created_at DESC, i.id DESC";
    const CREATE_INVITE_SQL: &str = "WITH manageable AS (
                    SELECT gm.guild_id
                    FROM guild_members gm
                    WHERE gm.guild_id = $1
                      AND gm.user_id = $3
                      AND (
                        EXISTS (
                          SELECT 1
                          FROM guilds g
                          WHERE g.id = gm.guild_id
                            AND g.owner_id = $3
                        )
                        OR EXISTS (
                          SELECT 1
                          FROM guild_member_roles_v2 gmr
                          JOIN guild_roles_v2 gr
                            ON gr.guild_id = gmr.guild_id
                           AND gr.role_key = gmr.role_key
                          WHERE gmr.guild_id = gm.guild_id
                            AND gmr.user_id = $3
                            AND gr.allow_manage = TRUE
                        )
                      )
                    FOR KEY SHARE
                 ),
                 target_channel AS (
                    SELECT
                      c.id AS channel_id,
                      c.guild_id,
                      c.name
                    FROM channels c
                    JOIN manageable m
                      ON m.guild_id = c.guild_id
                    WHERE c.id = $2
                      AND c.guild_id = $1
                      AND c.type = 'guild_text'
                 ),
                 inserted_invite AS (
                    INSERT INTO invites (
                      guild_id,
                      channel_id,
                      created_by,
                      code,
                      expires_at,
                      max_uses
                    )
                    SELECT
                      tc.guild_id,
                      tc.channel_id,
                      $3,
                      $4,
                      CASE
                        WHEN $5::bigint IS NULL THEN NULL
                        ELSE now() + ($5::bigint * interval '1 second')
                      END,
                      $6
                    FROM target_channel tc
                    RETURNING
                      code AS invite_code,
                      guild_id,
                      channel_id,
                      to_char(expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS expires_at_text,
                      uses,
                      max_uses
                 )
                 SELECT
                    ii.invite_code,
                    g.id AS guild_id,
                    g.name AS guild_name,
                    g.icon_key,
                    tc.channel_id,
                    tc.name AS channel_name,
                    ii.expires_at_text,
                    ii.uses,
                    ii.max_uses
                 FROM inserted_invite ii
                 JOIN guilds g
                   ON g.id = ii.guild_id
                 JOIN target_channel tc
                   ON tc.guild_id = ii.guild_id";
    const REVOKE_INVITE_SQL: &str = "WITH manageable AS (
                    SELECT gm.guild_id
                    FROM guild_members gm
                    WHERE gm.guild_id = $1
                      AND gm.user_id = $2
                      AND (
                        EXISTS (
                          SELECT 1
                          FROM guilds g
                          WHERE g.id = gm.guild_id
                            AND g.owner_id = $2
                        )
                        OR EXISTS (
                          SELECT 1
                          FROM guild_member_roles_v2 gmr
                          JOIN guild_roles_v2 gr
                            ON gr.guild_id = gmr.guild_id
                           AND gr.role_key = gmr.role_key
                          WHERE gmr.guild_id = gm.guild_id
                            AND gmr.user_id = $2
                            AND gr.allow_manage = TRUE
                        )
                      )
                    FOR KEY SHARE
                 ),
                 target_invite AS (
                    SELECT
                      i.id,
                      i.guild_id,
                      i.created_by,
                      i.code,
                      i.channel_id,
                      i.uses,
                      i.max_uses
                    FROM invites i
                    JOIN manageable m
                      ON m.guild_id = i.guild_id
                    WHERE i.guild_id = $1
                      AND i.code = $3
                      AND ($4::bigint IS NULL OR i.channel_id = $4)
                      AND i.is_disabled = FALSE
                      AND (i.expires_at IS NULL OR i.expires_at >= now())
                      AND (i.max_uses IS NULL OR i.uses < i.max_uses)
                    FOR UPDATE
                 ),
                 updated AS (
                    UPDATE invites i
                    SET is_disabled = TRUE
                    FROM target_invite ti
                    WHERE i.id = ti.id
                    RETURNING ti.id,
                              ti.guild_id,
                              ti.created_by,
                              ti.code,
                              ti.channel_id,
                              ti.uses,
                              ti.max_uses
                 ),
                 audit_insert AS (
                    INSERT INTO audit_logs (guild_id, actor_id, action, target_type, target_id, metadata)
                    SELECT
                      updated.guild_id,
                      $2,
                      'INVITE_DISABLE',
                      'invite',
                      updated.id,
                      jsonb_build_object(
                        'invite_code', updated.code,
                        'created_by', updated.created_by,
                        'channel_id', updated.channel_id,
                        'uses', updated.uses,
                        'max_uses', updated.max_uses
                      )
                    FROM updated
                 )
                 SELECT id
                 FROM updated";
    const VERIFY_PUBLIC_INVITE_SQL: &str = "SELECT
                    i.code AS invite_code,
                    CASE
                      WHEN i.is_disabled OR (i.max_uses IS NOT NULL AND i.uses >= i.max_uses) THEN 'invalid'
                      WHEN i.expires_at IS NOT NULL AND i.expires_at < now() THEN 'expired'
                      ELSE 'valid'
                    END AS invite_status,
                    g.id AS guild_id,
                    g.name AS guild_name,
                    g.icon_key,
                    i.channel_id,
                    c.name AS channel_name,
                    to_char(i.expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS expires_at_text,
                    i.uses,
                    i.max_uses
                 FROM invites i
                 JOIN guilds g
                   ON g.id = i.guild_id
                 LEFT JOIN channels c
                   ON c.id = i.channel_id
                 WHERE i.code = $1";
    const JOIN_INVITE_SQL: &str = "WITH locked_invite AS (
                    SELECT
                      i.id,
                      i.guild_id,
                      i.channel_id,
                      i.expires_at,
                      i.max_uses,
                      i.uses,
                      i.is_disabled
                    FROM invites i
                    WHERE i.code = $1
                    FOR UPDATE
                 ),
                 invite_membership AS (
                    SELECT
                      li.id AS invite_id,
                      li.guild_id,
                      li.channel_id,
                      li.expires_at,
                      li.max_uses,
                      li.uses,
                      li.is_disabled,
                      EXISTS (
                        SELECT 1
                        FROM guild_members gm
                        WHERE gm.guild_id = li.guild_id
                          AND gm.user_id = $2
                      ) AS already_member,
                      EXISTS (
                        SELECT 1
                        FROM invite_uses iu
                        WHERE iu.invite_id = li.id
                          AND iu.used_by = $2
                      ) AS already_used
                    FROM locked_invite li
                 ),
                 invite_state AS (
                    SELECT
                      im.invite_id,
                      im.guild_id,
                      im.channel_id,
                      im.already_used,
                      CASE
                        WHEN im.already_member THEN 'already_member'
                        WHEN im.is_disabled OR (im.max_uses IS NOT NULL AND im.uses >= im.max_uses) THEN 'invalid'
                        WHEN im.expires_at IS NOT NULL AND im.expires_at < now() THEN 'expired'
                        ELSE 'joinable'
                      END AS invite_decision
                    FROM invite_membership im
                 ),
                 member_insert AS (
                    INSERT INTO guild_members (guild_id, user_id)
                    SELECT state.guild_id, $2
                    FROM invite_state state
                    WHERE state.invite_decision = 'joinable'
                    ON CONFLICT (guild_id, user_id) DO NOTHING
                    RETURNING guild_id
                 ),
                 member_role_insert AS (
                    INSERT INTO guild_member_roles_v2 (guild_id, user_id, role_key)
                    SELECT inserted.guild_id, $2, 'member'::text
                    FROM member_insert inserted
                    ON CONFLICT (guild_id, user_id, role_key) DO NOTHING
                 ),
                 usage_insert AS (
                    INSERT INTO invite_uses (invite_id, used_by)
                    SELECT state.invite_id, $2
                    FROM invite_state state
                    WHERE state.invite_decision = 'joinable'
                      AND NOT state.already_used
                      AND EXISTS (
                        SELECT 1
                        FROM member_insert inserted
                        WHERE inserted.guild_id = state.guild_id
                      )
                    ON CONFLICT (invite_id, used_by) DO NOTHING
                    RETURNING invite_id
                 ),
                 invite_bump AS (
                    UPDATE invites i
                    SET uses = i.uses + 1
                    FROM usage_insert usage
                    WHERE i.id = usage.invite_id
                    RETURNING i.id
                 )
                 SELECT
                    state.guild_id,
                    state.invite_decision,
                    state.channel_id,
                    c.name AS channel_name
                 FROM invite_state state
                 LEFT JOIN channels c
                   ON c.id = state.channel_id";

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
        match env::var("INVITE_STORE_POOL_SIZE") {
            Ok(value) => match value.parse::<usize>() {
                Ok(0) => {
                    warn!(
                        env_var = "INVITE_STORE_POOL_SIZE",
                        value = %value,
                        default = Self::DEFAULT_POOL_SIZE,
                        "pool size must be >= 1; fallback to default"
                    );
                    Self::DEFAULT_POOL_SIZE
                }
                Ok(parsed) if parsed > Self::MAX_POOL_SIZE => {
                    warn!(
                        env_var = "INVITE_STORE_POOL_SIZE",
                        value = %value,
                        max = Self::MAX_POOL_SIZE,
                        "pool size exceeds upper bound; clamped"
                    );
                    Self::MAX_POOL_SIZE
                }
                Ok(parsed) => parsed,
                Err(error) => {
                    warn!(
                        env_var = "INVITE_STORE_POOL_SIZE",
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
    /// @throws InviteError 接続失敗時
    async fn connect_client(&self) -> Result<Arc<tokio_postgres::Client>, InviteError> {
        if !self.allow_postgres_notls {
            return Err(InviteError::dependency_unavailable("postgres_tls_required"));
        }

        let (client, connection) = tokio_postgres::connect(self.database_url.as_ref(), NoTls)
            .await
            .map_err(|error| {
                InviteError::dependency_unavailable(format!("postgres_connect_failed:{error}"))
            })?;

        tokio::spawn(async move {
            if let Err(error) = connection.await {
                tracing::error!(reason = %error, "invite postgres connection error");
            }
        });

        Ok(Arc::new(client))
    }

    /// 接続プールを初期化する。
    /// @param なし
    /// @returns 初期化結果
    /// @throws InviteError 接続失敗時
    async fn ensure_pool(&self) -> Result<(), InviteError> {
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
    /// @throws InviteError 接続未確立時
    async fn select_client(&self) -> Result<Arc<tokio_postgres::Client>, InviteError> {
        self.ensure_pool().await?;

        let guard = self.clients.read().await;
        if guard.is_empty() {
            return Err(InviteError::dependency_unavailable("postgres_pool_empty"));
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
    async fn map_database_error(&self, context: &str, error: tokio_postgres::Error) -> InviteError {
        if Self::should_invalidate_pool_for_error(&error) {
            self.invalidate_pool().await;
        }
        InviteError::dependency_unavailable(format!("{context}:{error}"))
    }

    /// 書き込み系DBエラーをAPIエラーへ変換する。
    /// @param context エラー文脈
    /// @param error Postgresエラー
    /// @returns APIエラー
    /// @throws なし
    async fn map_write_error(&self, context: &str, error: tokio_postgres::Error) -> InviteError {
        if Self::should_invalidate_pool_for_error(&error) {
            self.invalidate_pool().await;
        }

        if let Some(db_error) = error.as_db_error() {
            if db_error.code() == &tokio_postgres::error::SqlState::CHECK_VIOLATION {
                return InviteError::validation("invite_payload_invalid");
            }
            if db_error.code() == &tokio_postgres::error::SqlState::FOREIGN_KEY_VIOLATION
                && db_error.constraint() == Some("invites_guild_id_fkey")
            {
                return InviteError::not_found("guild_not_found");
            }
        }

        InviteError::dependency_unavailable(format!("{context}:{error}"))
    }

    /// guild存在を確認する。
    /// @param client Postgresクライアント
    /// @param guild_id 対象guild_id
    /// @returns guildが存在する場合は `true`
    /// @throws InviteError 依存障害時
    async fn has_guild(
        &self,
        client: &tokio_postgres::Client,
        guild_id: i64,
    ) -> Result<bool, InviteError> {
        match client
            .query_opt("SELECT 1 FROM guilds WHERE id = $1", &[&guild_id])
            .await
        {
            Ok(row) => Ok(row.is_some()),
            Err(error) => Err(self.map_database_error("guild_lookup_failed", error).await),
        }
    }

    /// guildメンバー所属を確認する。
    /// @param client Postgresクライアント
    /// @param guild_id 対象guild_id
    /// @param user_id 対象user_id
    /// @returns メンバー所属がある場合は `true`
    /// @throws InviteError 依存障害時
    async fn has_guild_membership(
        &self,
        client: &tokio_postgres::Client,
        guild_id: i64,
        user_id: i64,
    ) -> Result<bool, InviteError> {
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
            Err(error) => Err(
                self.map_database_error("guild_membership_lookup_failed", error)
                    .await,
            ),
        }
    }

    /// guildの管理権限を確認する。
    /// @param client Postgresクライアント
    /// @param principal_id 認証済みprincipal_id
    /// @param guild_id 対象guild_id
    /// @returns 管理権限がある場合は `true`
    /// @throws InviteError 依存障害時
    async fn has_manage_permission(
        &self,
        client: &tokio_postgres::Client,
        principal_id: PrincipalId,
        guild_id: i64,
    ) -> Result<bool, InviteError> {
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
            Err(error) => Err(
                self.map_database_error("guild_manage_permission_lookup_failed", error)
                    .await,
            ),
        }
    }

    /// guild管理対象へのアクセス前提を検証する。
    /// @param client Postgresクライアント
    /// @param principal_id 認証済みprincipal_id
    /// @param guild_id 対象guild_id
    /// @returns なし
    /// @throws InviteError 未存在、非権限、または依存障害時
    async fn verify_manageable_guild_access(
        &self,
        client: &tokio_postgres::Client,
        principal_id: PrincipalId,
        guild_id: i64,
    ) -> Result<(), InviteError> {
        if !self.has_guild(client, guild_id).await? {
            return Err(InviteError::not_found("guild_not_found"));
        }
        if !self.has_guild_membership(client, guild_id, principal_id.0).await? {
            return Err(InviteError::forbidden("guild_membership_required"));
        }
        if !self.has_manage_permission(client, principal_id, guild_id).await? {
            return Err(InviteError::forbidden("invite_manage_permission_required"));
        }

        Ok(())
    }

    /// channelの所属guildと種別を取得する。
    /// @param client Postgresクライアント
    /// @param channel_id 対象channel_id
    /// @returns channelが存在する場合は `Some((guild_id, channel_type))`
    /// @throws InviteError 依存障害時
    async fn find_channel_scope(
        &self,
        client: &tokio_postgres::Client,
        channel_id: i64,
    ) -> Result<Option<(i64, String)>, InviteError> {
        match client
            .query_opt(
                "SELECT guild_id, type::text AS channel_type
                 FROM channels
                 WHERE id = $1
                   AND guild_id IS NOT NULL",
                &[&channel_id],
            )
            .await
        {
            Ok(Some(row)) => Ok(Some((
                row.get::<&str, i64>("guild_id"),
                row.get::<&str, String>("channel_type"),
            ))),
            Ok(None) => Ok(None),
            Err(error) => Err(self.map_database_error("channel_scope_lookup_failed", error).await),
        }
    }

    /// guild配下のinvite状態を取得する。
    /// @param client Postgresクライアント
    /// @param guild_id 対象guild_id
    /// @param invite_code 対象invite_code
    /// @returns invite状態
    /// @throws InviteError 依存障害時
    async fn find_invite_state(
        &self,
        client: &tokio_postgres::Client,
        guild_id: i64,
        channel_id: Option<i64>,
        invite_code: &str,
    ) -> Result<Option<StoredInviteState>, InviteError> {
        match client
            .query_opt(
                "SELECT
                    is_disabled,
                    (expires_at IS NOT NULL AND expires_at < now()) AS is_expired,
                    (max_uses IS NOT NULL AND uses >= max_uses) AS is_maxed_out
                 FROM invites
                 WHERE guild_id = $1
                   AND code = $2
                   AND ($3::bigint IS NULL OR channel_id = $3)",
                &[&guild_id, &invite_code, &channel_id],
            )
            .await
        {
            Ok(Some(row)) => Ok(Some(StoredInviteState {
                is_disabled: row.get::<&str, bool>("is_disabled"),
                is_expired: row.get::<&str, bool>("is_expired"),
                is_maxed_out: row.get::<&str, bool>("is_maxed_out"),
            })),
            Ok(None) => Ok(None),
            Err(error) => Err(self.map_database_error("invite_state_lookup_failed", error).await),
        }
    }

    /// 重複しにくい招待コードを生成する。
    /// @param なし
    /// @returns 招待コード
    /// @throws なし
    fn generate_invite_code() -> String {
        uuid::Uuid::new_v4()
            .simple()
            .to_string()
            .chars()
            .take(10)
            .collect::<String>()
            .to_ascii_uppercase()
    }

    /// 招待コード一意制約違反かを判定する。
    /// @param error Postgresエラー
    /// @returns 招待コード unique 衝突なら `true`
    /// @throws なし
    fn is_invite_code_conflict(error: &tokio_postgres::Error) -> bool {
        let Some(db_error) = error.as_db_error() else {
            return false;
        };

        db_error.code() == &tokio_postgres::error::SqlState::UNIQUE_VIOLATION
            && db_error.constraint() == Some("invites_code_key")
    }

    /// 読み取り系DBエラーでプール破棄が必要か判定する。
    /// @param error Postgresエラー
    /// @returns 接続断系エラーの場合は `true`
    /// @throws なし
    fn should_invalidate_pool_for_error(error: &tokio_postgres::Error) -> bool {
        if error.is_closed() {
            return true;
        }

        std::error::Error::source(error)
            .and_then(|source| source.downcast_ref::<std::io::Error>())
            .is_some()
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct StoredInviteState {
    is_disabled: bool,
    is_expired: bool,
    is_maxed_out: bool,
}

#[async_trait]
impl InviteService for PostgresInviteService {
    /// 認証済みユーザーが guild 配下の有効な招待一覧を取得する。
    /// @param principal_id 取得主体ID
    /// @param guild_id 対象guild_id
    /// @returns guild配下の有効招待一覧
    /// @throws InviteError 入力不正、未存在、非権限、または依存障害時
    async fn list_invites(
        &self,
        principal_id: PrincipalId,
        guild_id: i64,
        channel_id: Option<i64>,
    ) -> Result<Vec<GuildInviteSummary>, InviteError> {
        if guild_id <= 0 {
            return Err(InviteError::validation("guild_id_must_be_positive"));
        }
        if matches!(channel_id, Some(value) if value <= 0) {
            return Err(InviteError::validation("channel_id_must_be_positive"));
        }

        let client = self.select_client().await?;
        let rows = match client
            .query(Self::LIST_INVITES_SQL, &[&guild_id, &principal_id.0, &channel_id])
            .await
        {
            Ok(rows) => rows,
            Err(error) => return Err(self.map_database_error("invite_list_failed", error).await),
        };

        if rows.is_empty() {
            self.verify_manageable_guild_access(&client, principal_id, guild_id)
                .await?;
            if let Some(channel_id) = channel_id {
                let Some((channel_guild_id, channel_type)) =
                    self.find_channel_scope(&client, channel_id).await?
                else {
                    return Err(InviteError::channel_not_found("invite_channel_not_found"));
                };
                if channel_guild_id != guild_id {
                    return Err(InviteError::validation("invite_channel_cross_guild"));
                }
                if channel_type != "guild_text" {
                    return Err(InviteError::validation("invite_channel_must_be_guild_text"));
                }
            }
        }

        rows.into_iter()
            .map(|row| {
                build_guild_invite_summary(
                    row.get::<&str, String>("invite_code"),
                    GuildInviteSummaryRecord {
                        channel: row.get::<&str, Option<i64>>("channel_id").map(|channel_id| {
                            InviteChannelSummary {
                                channel_id,
                                name: row.get::<&str, String>("channel_name"),
                            }
                        }),
                        creator: row.get::<&str, Option<i64>>("created_by").map(|user_id| {
                            InviteCreatorRecord {
                                user_id,
                                display_name: row.get::<&str, String>("creator_display_name"),
                            }
                        }),
                        expires_at: row.get::<&str, Option<String>>("expires_at_text"),
                        uses: row.get::<&str, i32>("uses"),
                        max_uses: row.get::<&str, Option<i32>>("max_uses"),
                        created_at: row.get::<&str, String>("created_at_text"),
                    },
                )
            })
            .collect()
    }

    /// 認証済みユーザーが guild 配下の招待を作成する。
    /// @param principal_id 作成主体ID
    /// @param guild_id 対象guild_id
    /// @param input 招待作成入力
    /// @returns 作成済み招待
    /// @throws InviteError 入力不正、未存在、非権限、または依存障害時
    async fn create_invite(
        &self,
        principal_id: PrincipalId,
        guild_id: i64,
        input: CreateInviteInput,
    ) -> Result<CreatedInvite, InviteError> {
        if guild_id <= 0 {
            return Err(InviteError::validation("guild_id_must_be_positive"));
        }

        let normalized_input = normalize_create_invite_input(input)?;
        let client = self.select_client().await?;

        for _ in 0..3 {
            let invite_code = Self::generate_invite_code();
            let row = match client
                .query_opt(
                    Self::CREATE_INVITE_SQL,
                    &[
                        &guild_id,
                        &normalized_input.channel_id,
                        &principal_id.0,
                        &invite_code,
                        &normalized_input.max_age_seconds,
                        &normalized_input.max_uses,
                    ],
                )
                .await
            {
                Ok(Some(row)) => row,
                Ok(None) => {
                    self.verify_manageable_guild_access(&client, principal_id, guild_id)
                        .await?;

                    let Some((channel_guild_id, channel_type)) =
                        self.find_channel_scope(&client, normalized_input.channel_id).await?
                    else {
                        return Err(InviteError::channel_not_found("invite_channel_not_found"));
                    };
                    if channel_guild_id != guild_id {
                        return Err(InviteError::validation("invite_channel_cross_guild"));
                    }
                    if channel_type != "guild_text" {
                        return Err(InviteError::validation("invite_channel_must_be_guild_text"));
                    }

                    return Err(InviteError::dependency_unavailable(
                        "invite_create_rejected_without_reason",
                    ));
                }
                Err(error) => {
                    if Self::is_invite_code_conflict(&error) {
                        continue;
                    }
                    return Err(self.map_write_error("invite_create_insert_failed", error).await);
                }
            };

            let record = CreatedInviteRecord {
                guild: PublicInviteGuild {
                    guild_id: row.get::<&str, i64>("guild_id"),
                    name: row.get::<&str, String>("guild_name"),
                    icon_key: row.get::<&str, Option<String>>("icon_key"),
                },
                channel: InviteChannelSummary {
                    channel_id: row.get::<&str, i64>("channel_id"),
                    name: row.get::<&str, String>("channel_name"),
                },
                expires_at: row.get::<&str, Option<String>>("expires_at_text"),
                uses: row.get::<&str, i32>("uses"),
                max_uses: row.get::<&str, Option<i32>>("max_uses"),
            };

            return build_created_invite(row.get::<&str, String>("invite_code"), record);
        }

        Err(InviteError::dependency_unavailable(
            "invite_code_generation_exhausted",
        ))
    }

    /// 公開招待コードを検証する。
    /// @param invite_code 検証対象の招待コード
    /// @returns 検証結果
    /// @throws InviteError 入力不正または依存障害時
    async fn verify_public_invite(
        &self,
        invite_code: String,
    ) -> Result<PublicInviteLookup, InviteError> {
        let normalized_invite_code = normalize_invite_code(&invite_code)?;
        let client = self.select_client().await?;
        let row = match client
            .query_opt(Self::VERIFY_PUBLIC_INVITE_SQL, &[&normalized_invite_code])
            .await
        {
            Ok(row) => row,
            Err(error) => return Err(self.map_database_error("invite_lookup_failed", error).await),
        };

        let record = row.map(|row| {
            let status = match row.get::<&str, String>("invite_status").as_str() {
                "valid" => PublicInviteStatus::Valid,
                "expired" => PublicInviteStatus::Expired,
                _ => PublicInviteStatus::Invalid,
            };

            InviteRecord {
                status,
                guild: PublicInviteGuild {
                    guild_id: row.get::<&str, i64>("guild_id"),
                    name: row.get::<&str, String>("guild_name"),
                    icon_key: row.get::<&str, Option<String>>("icon_key"),
                },
                channel: row.get::<&str, Option<i64>>("channel_id").map(|channel_id| {
                    InviteChannelSummary {
                        channel_id,
                        name: row.get::<&str, String>("channel_name"),
                    }
                }),
                expires_at: row.get::<&str, Option<String>>("expires_at_text"),
                uses: row.get::<&str, i32>("uses"),
                max_uses: row.get::<&str, Option<i32>>("max_uses"),
            }
        });

        build_public_invite_lookup(normalized_invite_code, record)
    }

    /// 認証済みユーザーを招待コードでギルドへ参加させる。
    /// @param principal_id 参加主体ID
    /// @param invite_code 参加対象の招待コード
    /// @returns 参加結果
    /// @throws InviteError 入力不正、招待状態不正、または依存障害時
    async fn join_invite(
        &self,
        principal_id: PrincipalId,
        invite_code: String,
    ) -> Result<InviteJoinResult, InviteError> {
        let normalized_invite_code = normalize_invite_code(&invite_code)?;
        let client = self.select_client().await?;
        let row = match client
            .query_opt(Self::JOIN_INVITE_SQL, &[&normalized_invite_code, &principal_id.0])
            .await
        {
            Ok(row) => row,
            Err(error) => return Err(self.map_database_error("invite_join_failed", error).await),
        };

        let record = row.map(|row| {
            let decision = match row.get::<&str, String>("invite_decision").as_str() {
                "already_member" => InviteJoinDecision::AlreadyMember,
                "expired" => InviteJoinDecision::Expired,
                "joinable" => InviteJoinDecision::Joined,
                _ => InviteJoinDecision::Invalid,
            };

            InviteJoinRecord {
                guild_id: row.get::<&str, i64>("guild_id"),
                channel: row.get::<&str, Option<i64>>("channel_id").map(|channel_id| {
                    InviteChannelSummary {
                        channel_id,
                        name: row.get::<&str, String>("channel_name"),
                    }
                }),
                decision,
            }
        });

        build_invite_join_result(normalized_invite_code, record)
    }

    /// 認証済みユーザーが guild 配下の招待を取り消す。
    /// @param principal_id 取消主体ID
    /// @param guild_id 対象guild_id
    /// @param invite_code 取消対象の招待コード
    /// @returns なし
    /// @throws InviteError 入力不正、未存在、無効招待、非権限、または依存障害時
    async fn revoke_invite(
        &self,
        principal_id: PrincipalId,
        guild_id: i64,
        channel_id: Option<i64>,
        invite_code: String,
    ) -> Result<(), InviteError> {
        if guild_id <= 0 {
            return Err(InviteError::validation("guild_id_must_be_positive"));
        }
        if matches!(channel_id, Some(value) if value <= 0) {
            return Err(InviteError::validation("channel_id_must_be_positive"));
        }

        let normalized_invite_code = normalize_invite_code(&invite_code)?;
        let client = self.select_client().await?;
        let row = match client
            .query_opt(
                Self::REVOKE_INVITE_SQL,
                &[&guild_id, &principal_id.0, &normalized_invite_code, &channel_id],
            )
            .await
        {
            Ok(row) => row,
            Err(error) => return Err(self.map_write_error("invite_revoke_failed", error).await),
        };

        if row.is_some() {
            return Ok(());
        }

        self.verify_manageable_guild_access(&client, principal_id, guild_id)
            .await?;
        if let Some(channel_id) = channel_id {
            let Some((channel_guild_id, channel_type)) =
                self.find_channel_scope(&client, channel_id).await?
            else {
                return Err(InviteError::channel_not_found("invite_channel_not_found"));
            };
            if channel_guild_id != guild_id {
                return Err(InviteError::validation("invite_channel_cross_guild"));
            }
            if channel_type != "guild_text" {
                return Err(InviteError::validation("invite_channel_must_be_guild_text"));
            }
        }

        match self
            .find_invite_state(&client, guild_id, channel_id, &normalized_invite_code)
            .await?
        {
            Some(state) if state.is_disabled || state.is_expired || state.is_maxed_out => {
                Err(InviteError::invalid_invite("invite_invalid"))
            }
            Some(_) => Err(InviteError::dependency_unavailable(
                "invite_revoke_rejected_without_reason",
            )),
            None => Err(InviteError::invite_not_found("invite_not_found")),
        }
    }
}
