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
                    to_char(i.expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS expires_at_text,
                    i.uses,
                    i.max_uses
                 FROM invites i
                 JOIN guilds g
                   ON g.id = i.guild_id
                 WHERE i.code = $1";

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
    async fn map_read_error(&self, context: &str, error: tokio_postgres::Error) -> InviteError {
        if Self::should_invalidate_pool_for_read_error(&error) {
            self.invalidate_pool().await;
        }
        InviteError::dependency_unavailable(format!("{context}:{error}"))
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
}

#[async_trait]
impl InviteService for PostgresInviteService {
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
            Err(error) => return Err(self.map_read_error("invite_lookup_failed", error).await),
        };

        let record = row.map(|row| {
            let status = match row.get::<&str, String>("invite_status").as_str() {
                "valid" => PublicInviteStatus::Valid,
                "expired" => PublicInviteStatus::Expired,
                _ => PublicInviteStatus::Invalid,
            };

            InviteRecord {
                invite_code: row.get::<&str, String>("invite_code"),
                status,
                guild: PublicInviteGuild {
                    guild_id: row.get::<&str, i64>("guild_id"),
                    name: row.get::<&str, String>("guild_name"),
                    icon_key: row.get::<&str, Option<String>>("icon_key"),
                },
                expires_at: row.get::<&str, Option<String>>("expires_at_text"),
                uses: row.get::<&str, i32>("uses"),
                max_uses: row.get::<&str, Option<i32>>("max_uses"),
            }
        });

        build_public_invite_lookup(normalized_invite_code, record)
    }
}
