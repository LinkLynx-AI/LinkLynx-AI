/// キャッシュ層を表現する。
#[async_trait]
pub trait PrincipalCache: Send + Sync {
    /// キャッシュからprincipalを取得する。
    /// @param provider 認証プロバイダ
    /// @param subject 外部主体値
    /// @returns principal_id（存在時）
    /// @throws String キャッシュ障害時
    async fn get(&self, provider: &str, subject: &str) -> Result<Option<PrincipalId>, String>;

    /// キャッシュへprincipalを保存する。
    /// @param provider 認証プロバイダ
    /// @param subject 外部主体値
    /// @param principal_id 保存するprincipal_id
    /// @param ttl 保存TTL
    /// @returns なし
    /// @throws String キャッシュ障害時
    async fn set(
        &self,
        provider: &str,
        subject: &str,
        principal_id: PrincipalId,
        ttl: Duration,
    ) -> Result<(), String>;
}

/// principal自動プロビジョニング要求を保持する。
#[derive(Debug, Clone)]
pub struct PrincipalProvisionRequest {
    pub email: String,
    pub display_name: String,
}

impl PrincipalProvisionRequest {
    /// 検証済みトークンからプロビジョニング要求を組み立てる。
    /// @param verified Firebase検証済みトークン情報
    /// @returns プロビジョニング要求
    /// @throws なし
    fn from_verified_token(verified: &VerifiedToken) -> Self {
        Self {
            email: normalized_email(&verified.uid, verified.email.as_deref()),
            display_name: normalized_display_name(&verified.uid, verified.display_name.as_deref()),
        }
    }
}

/// principal自動プロビジョニング結果を保持する。
#[derive(Debug, Clone, Copy)]
pub struct PrincipalProvisionResult {
    pub principal_id: PrincipalId,
    pub retried: bool,
}

/// principal自動プロビジョニング失敗を表現する。
#[derive(Debug, Clone)]
pub enum PrincipalProvisionError {
    InvalidInput(String),
    Conflict(String),
    DependencyUnavailable(String),
}

/// 永続ストア層を表現する。
#[async_trait]
pub trait PrincipalStore: Send + Sync {
    /// 永続ストアからprincipalを取得する。
    /// @param provider 認証プロバイダ
    /// @param subject 外部主体値
    /// @returns principal_id（存在時）
    /// @throws String ストア障害時
    async fn find_principal_id(
        &self,
        provider: &str,
        subject: &str,
    ) -> Result<Option<PrincipalId>, String>;

    /// 永続ストアでprincipalを冪等生成する。
    /// @param provider 認証プロバイダ
    /// @param subject 外部主体値
    /// @param request プロビジョニング要求
    /// @returns principal_id
    /// @throws PrincipalProvisionError 入力不正/競合/依存障害時
    async fn find_or_provision_principal_id(
        &self,
        provider: &str,
        subject: &str,
        request: &PrincipalProvisionRequest,
    ) -> Result<PrincipalProvisionResult, PrincipalProvisionError>;
}

/// uid->principal解決のキャッシュ付き実装を表現する。
pub struct CachingPrincipalResolver {
    provider: String,
    cache: Arc<dyn PrincipalCache>,
    store: Arc<dyn PrincipalStore>,
    cache_ttl: Duration,
    metrics: Arc<AuthMetrics>,
}

impl CachingPrincipalResolver {
    /// 解決器を生成する。
    /// @param provider 認証プロバイダ名
    /// @param cache キャッシュ実装
    /// @param store 永続ストア実装
    /// @param cache_ttl キャッシュTTL
    /// @param metrics メトリクス集計器
    /// @returns キャッシュ付き解決器
    /// @throws なし
    pub fn new(
        provider: String,
        cache: Arc<dyn PrincipalCache>,
        store: Arc<dyn PrincipalStore>,
        cache_ttl: Duration,
        metrics: Arc<AuthMetrics>,
    ) -> Self {
        Self {
            provider,
            cache,
            store,
            cache_ttl,
            metrics,
        }
    }
}

#[async_trait]
impl PrincipalResolver for CachingPrincipalResolver {
    /// UIDからprincipal_idを解決し、未解決時は自動プロビジョニングする。
    /// @param verified Firebase検証済みトークン情報
    /// @returns principal_id
    /// @throws PrincipalResolveError 入力不正/競合/依存障害時
    async fn resolve_principal_id(
        &self,
        verified: &VerifiedToken,
    ) -> Result<PrincipalId, PrincipalResolveError> {
        let uid = verified.uid.trim();
        if uid.is_empty() {
            return Err(PrincipalResolveError::InvalidInput(
                "firebase_uid_missing".to_owned(),
            ));
        }

        match self.cache.get(&self.provider, uid).await {
            Ok(Some(principal_id)) => {
                self.metrics.record_principal_cache(true);
                return Ok(principal_id);
            }
            Ok(None) => {
                self.metrics.record_principal_cache(false);
            }
            Err(error) => {
                self.metrics.record_principal_cache(false);
                warn!(reason = %error, provider = %self.provider, uid = %uid, "principal cache unavailable, fallback to store");
            }
        }

        if let Some(principal_id) = self
            .store
            .find_principal_id(&self.provider, uid)
            .await
            .map_err(PrincipalResolveError::DependencyUnavailable)?
        {
            if let Err(error) = self
                .cache
                .set(&self.provider, uid, principal_id, self.cache_ttl)
                .await
            {
                warn!(reason = %error, provider = %self.provider, uid = %uid, "failed to refresh principal cache");
            }
            return Ok(principal_id);
        }

        let provision_request = PrincipalProvisionRequest::from_verified_token(verified);
        let provision_result = self
            .store
            .find_or_provision_principal_id(&self.provider, uid, &provision_request)
            .await
            .map_err(|error| {
                self.metrics.record_principal_provision(false);
                match error {
                    PrincipalProvisionError::InvalidInput(reason) => {
                        warn!(provider = %self.provider, uid = %uid, reason = %reason, "principal provisioning rejected by invalid input");
                        PrincipalResolveError::InvalidInput(reason)
                    }
                    PrincipalProvisionError::Conflict(reason) => {
                        warn!(provider = %self.provider, uid = %uid, reason = %reason, "principal provisioning conflict");
                        PrincipalResolveError::Conflict(reason)
                    }
                    PrincipalProvisionError::DependencyUnavailable(reason) => {
                        warn!(provider = %self.provider, uid = %uid, reason = %reason, "principal provisioning unavailable");
                        PrincipalResolveError::DependencyUnavailable(reason)
                    }
                }
            })?;

        self.metrics.record_principal_provision(true);
        if provision_result.retried {
            self.metrics.record_principal_provision_retry();
        }

        if let Err(error) = self
            .cache
            .set(&self.provider, uid, provision_result.principal_id, self.cache_ttl)
            .await
        {
            warn!(reason = %error, provider = %self.provider, uid = %uid, "failed to refresh principal cache after provisioning");
        }

        info!(
            provider = %self.provider,
            uid = %uid,
            principal_id = provision_result.principal_id.0,
            retried = provision_result.retried,
            "principal mapping provisioned"
        );

        Ok(provision_result.principal_id)
    }
}

#[derive(Debug, Clone)]
struct InMemoryCacheEntry {
    principal_id: PrincipalId,
    expires_at: Instant,
}

/// Dragonfly互換のインメモリキャッシュを表現する。
#[derive(Clone)]
pub struct InMemoryPrincipalCache {
    entries: Arc<RwLock<HashMap<String, InMemoryCacheEntry>>>,
    available: Arc<AtomicBool>,
}

impl Default for InMemoryPrincipalCache {
    fn default() -> Self {
        Self {
            entries: Arc::new(RwLock::new(HashMap::new())),
            available: Arc::new(AtomicBool::new(true)),
        }
    }
}

#[async_trait]
impl PrincipalCache for InMemoryPrincipalCache {
    /// キャッシュからprincipalを取得する。
    /// @param provider 認証プロバイダ
    /// @param subject 外部主体値
    /// @returns principal_id（存在時）
    /// @throws String キャッシュ障害時
    async fn get(&self, provider: &str, subject: &str) -> Result<Option<PrincipalId>, String> {
        if !self.available.load(Ordering::Relaxed) {
            return Err("dragonfly_unavailable".to_owned());
        }

        let key = format!("{provider}:{subject}");
        let now = Instant::now();
        {
            let entries = self.entries.read().await;
            if let Some(entry) = entries.get(&key) {
                if entry.expires_at > now {
                    return Ok(Some(entry.principal_id));
                }
            }
        }

        let mut entries = self.entries.write().await;
        if let Some(entry) = entries.get(&key).cloned() {
            if entry.expires_at > now {
                return Ok(Some(entry.principal_id));
            }
            entries.remove(&key);
        }

        Ok(None)
    }

    /// キャッシュへprincipalを保存する。
    /// @param provider 認証プロバイダ
    /// @param subject 外部主体値
    /// @param principal_id 保存するprincipal_id
    /// @param ttl 保存TTL
    /// @returns なし
    /// @throws String キャッシュ障害時
    async fn set(
        &self,
        provider: &str,
        subject: &str,
        principal_id: PrincipalId,
        ttl: Duration,
    ) -> Result<(), String> {
        if !self.available.load(Ordering::Relaxed) {
            return Err("dragonfly_unavailable".to_owned());
        }

        let key = format!("{provider}:{subject}");
        let mut entries = self.entries.write().await;
        entries.insert(
            key,
            InMemoryCacheEntry {
                principal_id,
                expires_at: Instant::now() + ttl,
            },
        );
        Ok(())
    }
}

/// DBフォールバック相当のインメモリ永続ストアを表現する。
#[derive(Clone)]
pub struct InMemoryPrincipalStore {
    entries: Arc<RwLock<HashMap<String, PrincipalId>>>,
    available: Arc<AtomicBool>,
    next_principal_id: Arc<AtomicI64>,
}

impl Default for InMemoryPrincipalStore {
    fn default() -> Self {
        Self {
            entries: Arc::new(RwLock::new(HashMap::new())),
            available: Arc::new(AtomicBool::new(true)),
            next_principal_id: Arc::new(AtomicI64::new(10_000)),
        }
    }
}

impl InMemoryPrincipalStore {
    /// 環境変数シード付きストアを生成する。
    /// @param なし
    /// @returns ストア実装
    /// @throws なし
    pub fn from_env() -> Self {
        let mut entries = HashMap::new();
        let mut max_principal_id = 9_999_i64;

        if let Ok(seed) = env::var("AUTH_UID_PRINCIPAL_SEEDS") {
            for pair in seed.split(',').filter(|value| !value.trim().is_empty()) {
                let Some((uid, principal_id)) = pair.split_once('=') else {
                    continue;
                };

                let Ok(principal_id) = principal_id.trim().parse::<i64>() else {
                    continue;
                };

                let key = format!("{}:{}", FIREBASE_PROVIDER, uid.trim());
                entries.insert(key, PrincipalId(principal_id));
                max_principal_id = max_principal_id.max(principal_id);
            }
        }

        Self {
            entries: Arc::new(RwLock::new(entries)),
            available: Arc::new(AtomicBool::new(true)),
            next_principal_id: Arc::new(AtomicI64::new(max_principal_id + 1)),
        }
    }

    /// テスト/初期化用にエントリを追加する。
    /// @param provider 認証プロバイダ
    /// @param subject 外部主体値
    /// @param principal_id principal_id
    /// @returns なし
    /// @throws なし
    #[cfg(test)]
    pub async fn insert(&self, provider: &str, subject: &str, principal_id: PrincipalId) {
        let key = format!("{provider}:{subject}");
        self.entries.write().await.insert(key, principal_id);
        let next = principal_id.0.saturating_add(1);
        self.next_principal_id.fetch_max(next, Ordering::Relaxed);
    }
}

#[async_trait]
impl PrincipalStore for InMemoryPrincipalStore {
    /// 永続ストアからprincipalを取得する。
    /// @param provider 認証プロバイダ
    /// @param subject 外部主体値
    /// @returns principal_id（存在時）
    /// @throws String ストア障害時
    async fn find_principal_id(
        &self,
        provider: &str,
        subject: &str,
    ) -> Result<Option<PrincipalId>, String> {
        if !self.available.load(Ordering::Relaxed) {
            return Err("principal_store_unavailable".to_owned());
        }

        let key = format!("{provider}:{subject}");
        let entries = self.entries.read().await;
        Ok(entries.get(&key).copied())
    }

    /// 永続ストアでprincipalを冪等生成する。
    /// @param provider 認証プロバイダ
    /// @param subject 外部主体値
    /// @param _request プロビジョニング要求
    /// @returns principal_id
    /// @throws PrincipalProvisionError 入力不正/依存障害時
    async fn find_or_provision_principal_id(
        &self,
        provider: &str,
        subject: &str,
        _request: &PrincipalProvisionRequest,
    ) -> Result<PrincipalProvisionResult, PrincipalProvisionError> {
        if !self.available.load(Ordering::Relaxed) {
            return Err(PrincipalProvisionError::DependencyUnavailable(
                "principal_store_unavailable".to_owned(),
            ));
        }

        if provider.trim().is_empty() || subject.trim().is_empty() {
            return Err(PrincipalProvisionError::InvalidInput(
                "principal_mapping_input_invalid".to_owned(),
            ));
        }

        let key = format!("{provider}:{subject}");
        {
            let entries = self.entries.read().await;
            if let Some(principal_id) = entries.get(&key).copied() {
                return Ok(PrincipalProvisionResult {
                    principal_id,
                    retried: true,
                });
            }
        }

        let next = self.next_principal_id.fetch_add(1, Ordering::Relaxed);
        let principal_id = PrincipalId(next.max(1));
        let mut entries = self.entries.write().await;
        let resolved = entries.entry(key).or_insert(principal_id);
        Ok(PrincipalProvisionResult {
            principal_id: *resolved,
            retried: *resolved != principal_id,
        })
    }
}

/// Postgresのauth_identities参照を行う永続ストアを表現する。
#[derive(Clone)]
pub struct PostgresPrincipalStore {
    database_url: Arc<str>,
    clients: Arc<RwLock<Vec<Arc<tokio_postgres::Client>>>>,
    next_index: Arc<AtomicU64>,
    pool_size: usize,
    max_retries: u32,
    retry_base_backoff: Duration,
    transport_security: PostgresTransportSecurity,
}

#[derive(Clone, Copy)]
enum PostgresTransportSecurity {
    TlsRequiredFailClose,
    NoTlsAllowed,
}

enum ProvisionAttemptError {
    Conflict(String),
    InvalidInput(String),
    Retryable(String),
}

const LEGACY_PROVISION_PASSWORD_HASH: &str =
    "$argon2id$v=19$m=65536,t=3,p=1$firebase$provisioned";

impl PostgresPrincipalStore {
    /// Postgresストアを生成する。
    /// @param database_url 接続文字列
    /// @returns Postgres principalストア
    /// @throws なし
    pub fn new(database_url: String) -> Self {
        let pool_size = parse_env_u64("AUTH_PRINCIPAL_STORE_POOL_SIZE", 4).max(1) as usize;
        let max_retries = parse_env_u64("AUTH_PRINCIPAL_STORE_MAX_RETRIES", 2).min(8) as u32;
        let retry_base_backoff = Duration::from_millis(
            parse_env_u64("AUTH_PRINCIPAL_STORE_RETRY_BASE_BACKOFF_MS", 25),
        );
        let transport_security = if parse_env_bool("AUTH_ALLOW_POSTGRES_NOTLS", false) {
            warn!(
                "AUTH_ALLOW_POSTGRES_NOTLS=true is enabled; Postgres principal store will use plaintext connection"
            );
            PostgresTransportSecurity::NoTlsAllowed
        } else {
            PostgresTransportSecurity::TlsRequiredFailClose
        };

        Self {
            database_url: Arc::from(database_url),
            clients: Arc::new(RwLock::new(Vec::new())),
            next_index: Arc::new(AtomicU64::new(0)),
            pool_size,
            max_retries,
            retry_base_backoff,
            transport_security,
        }
    }

    /// Postgres接続を1本生成する。
    /// @param なし
    /// @returns Postgresクライアント
    /// @throws String 接続失敗時
    async fn connect_client(&self) -> Result<Arc<tokio_postgres::Client>, String> {
        let (client, connection) = match self.transport_security {
            PostgresTransportSecurity::TlsRequiredFailClose => {
                return Err("postgres_tls_required: set AUTH_ALLOW_POSTGRES_NOTLS=true only for local development until TLS connector is configured".to_owned());
            }
            PostgresTransportSecurity::NoTlsAllowed => {
                tokio_postgres::connect(self.database_url.as_ref(), NoTls)
                    .await
                    .map_err(|error| format!("postgres_connect_notls_failed:{error}"))?
            }
        };

        tokio::spawn(async move {
            if let Err(error) = connection.await {
                tracing::error!(reason = %error, "postgres principal store connection error");
            }
        });

        Ok(Arc::new(client))
    }

    /// 接続プールを初期化する。
    /// @param なし
    /// @returns なし
    /// @throws String 接続失敗時
    async fn ensure_pool(&self) -> Result<(), String> {
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

    /// 利用可能な接続クライアントを選択する。
    /// @param なし
    /// @returns Postgresクライアント
    /// @throws String 接続未確立時
    async fn select_client(&self) -> Result<Arc<tokio_postgres::Client>, String> {
        self.ensure_pool().await?;

        let guard = self.clients.read().await;
        if guard.is_empty() {
            return Err("postgres_pool_empty".to_owned());
        }

        let index = (self.next_index.fetch_add(1, Ordering::Relaxed) as usize) % guard.len();
        Ok(Arc::clone(&guard[index]))
    }

    /// リトライ待機時間を返す。
    /// @param attempt リトライ試行回数(0始まり)
    /// @returns 次回待機時間
    /// @throws なし
    fn retry_delay(&self, attempt: u32) -> Duration {
        let factor = 1u32.checked_shl(attempt.min(16)).unwrap_or(u32::MAX);
        self.retry_base_backoff.saturating_mul(factor)
    }

    /// 接続プールを破棄して再接続を促す。
    /// @param なし
    /// @returns なし
    /// @throws なし
    async fn invalidate_pool(&self) {
        let mut guard = self.clients.write().await;
        guard.clear();
    }

    /// principal_idを1件検索する。
    /// @param client Postgresクライアント
    /// @param provider 認証プロバイダ
    /// @param subject 外部主体値
    /// @returns principal_id（存在時）
    /// @throws String クエリ失敗時
    async fn query_principal_id(
        &self,
        client: &Arc<tokio_postgres::Client>,
        provider: &str,
        subject: &str,
    ) -> Result<Option<PrincipalId>, String> {
        let row = client
            .query_opt(
                "SELECT principal_id FROM auth_identities WHERE provider = $1 AND provider_subject = $2 LIMIT 1",
                &[&provider, &subject],
            )
            .await
            .map_err(|error| format!("postgres_query_failed:{error}"))?;

        Ok(row.map(|row| PrincipalId(row.get::<usize, i64>(0))))
    }

    /// 新規ユーザー行を挿入してprincipal_idを払い出す。
    /// @param client Postgresクライアント
    /// @param request プロビジョニング要求
    /// @returns principal_id
    /// @throws ProvisionAttemptError 競合/入力不正/依存障害時
    async fn insert_user_for_provision(
        &self,
        client: &Arc<tokio_postgres::Client>,
        request: &PrincipalProvisionRequest,
    ) -> Result<PrincipalId, ProvisionAttemptError> {
        if request.email.trim().is_empty() || request.display_name.trim().is_empty() {
            return Err(ProvisionAttemptError::InvalidInput(
                "principal_profile_invalid".to_owned(),
            ));
        }

        let modern_query =
            "INSERT INTO users (email, display_name, theme, status_text) VALUES ($1, $2, 'dark', NULL) RETURNING id";
        match client
            .query_one(modern_query, &[&request.email, &request.display_name])
            .await
        {
            Ok(row) => return Ok(PrincipalId(row.get::<usize, i64>(0))),
            Err(error) => {
                if is_email_unique_violation(&error) {
                    return Err(ProvisionAttemptError::Conflict(
                        "principal_provision_email_conflict".to_owned(),
                    ));
                }

                if error.code() != Some(&SqlState::NOT_NULL_VIOLATION) {
                    return Err(ProvisionAttemptError::Retryable(format!(
                        "postgres_insert_user_failed:{error}"
                    )));
                }
            }
        }

        let legacy_query = "INSERT INTO users (email, email_verified, password_hash, display_name, theme, status_text) VALUES ($1, TRUE, $3, $2, 'dark', NULL) RETURNING id";
        client
            .query_one(
                legacy_query,
                &[
                    &request.email,
                    &request.display_name,
                    &LEGACY_PROVISION_PASSWORD_HASH,
                ],
            )
            .await
            .map(|row| PrincipalId(row.get::<usize, i64>(0)))
            .map_err(|error| {
                if is_email_unique_violation(&error) {
                    return ProvisionAttemptError::Conflict(
                        "principal_provision_email_conflict".to_owned(),
                    );
                }

                ProvisionAttemptError::Retryable(format!("postgres_insert_user_failed:{error}"))
            })
    }

    /// principal mappingを挿入する。
    /// @param client Postgresクライアント
    /// @param provider 認証プロバイダ
    /// @param subject 外部主体値
    /// @param principal_id principal_id
    /// @returns 挿入成否
    /// @throws ProvisionAttemptError 競合/依存障害時
    async fn insert_identity_mapping(
        &self,
        client: &Arc<tokio_postgres::Client>,
        provider: &str,
        subject: &str,
        principal_id: PrincipalId,
    ) -> Result<bool, ProvisionAttemptError> {
        let inserted = client
            .query_opt(
                "INSERT INTO auth_identities (provider, provider_subject, principal_id) VALUES ($1, $2, $3) ON CONFLICT (provider, provider_subject) DO NOTHING RETURNING principal_id",
                &[&provider, &subject, &principal_id.0],
            )
            .await
            .map_err(|error| {
                if error.code() == Some(&SqlState::UNIQUE_VIOLATION) {
                    return ProvisionAttemptError::Conflict(
                        "principal_mapping_conflict".to_owned(),
                    );
                }
                ProvisionAttemptError::Retryable(format!("postgres_insert_identity_failed:{error}"))
            })?;

        Ok(inserted.is_some())
    }

    /// プロビジョニングで不要化したユーザーを掃除する。
    /// @param client Postgresクライアント
    /// @param principal_id 掃除対象principal_id
    /// @returns なし
    /// @throws なし
    async fn cleanup_orphan_user(
        &self,
        client: &Arc<tokio_postgres::Client>,
        principal_id: PrincipalId,
    ) {
        if let Err(error) = client
            .execute("DELETE FROM users WHERE id = $1", &[&principal_id.0])
            .await
        {
            warn!(
                principal_id = principal_id.0,
                reason = %error,
                "failed to cleanup orphan provisioned user"
            );
        }
    }

    /// 1回分のプロビジョニング試行を実行する。
    /// @param client Postgresクライアント
    /// @param provider 認証プロバイダ
    /// @param subject 外部主体値
    /// @param request プロビジョニング要求
    /// @returns principal_id
    /// @throws ProvisionAttemptError 競合/入力不正/依存障害時
    async fn provision_once(
        &self,
        client: &Arc<tokio_postgres::Client>,
        provider: &str,
        subject: &str,
        request: &PrincipalProvisionRequest,
    ) -> Result<PrincipalProvisionResult, ProvisionAttemptError> {
        if provider.trim().is_empty() || subject.trim().is_empty() {
            return Err(ProvisionAttemptError::InvalidInput(
                "principal_mapping_input_invalid".to_owned(),
            ));
        }

        if let Some(existing) = self
            .query_principal_id(client, provider, subject)
            .await
            .map_err(ProvisionAttemptError::Retryable)?
        {
            return Ok(PrincipalProvisionResult {
                principal_id: existing,
                retried: true,
            });
        }

        let inserted_user = match self.insert_user_for_provision(client, request).await {
            Ok(principal_id) => principal_id,
            Err(ProvisionAttemptError::Conflict(reason)) => {
                let resolved = self
                    .query_principal_id(client, provider, subject)
                    .await
                    .map_err(ProvisionAttemptError::Retryable)?;
                if let Some(principal_id) = resolved {
                    return Ok(PrincipalProvisionResult {
                        principal_id,
                        retried: true,
                    });
                }

                return Err(ProvisionAttemptError::Conflict(reason));
            }
            Err(error) => return Err(error),
        };
        let inserted_mapping =
            match self
                .insert_identity_mapping(client, provider, subject, inserted_user)
                .await
            {
                Ok(inserted) => inserted,
                Err(ProvisionAttemptError::Retryable(reason)) => {
                    self.cleanup_orphan_user(client, inserted_user).await;
                    return Err(ProvisionAttemptError::Retryable(reason));
                }
                Err(ProvisionAttemptError::Conflict(reason)) => {
                    let resolved = self
                        .query_principal_id(client, provider, subject)
                        .await
                        .map_err(ProvisionAttemptError::Retryable)?;
                    if let Some(principal_id) = resolved {
                        if principal_id != inserted_user {
                            self.cleanup_orphan_user(client, inserted_user).await;
                        }
                        return Ok(PrincipalProvisionResult {
                            principal_id,
                            retried: true,
                        });
                    }

                    self.cleanup_orphan_user(client, inserted_user).await;
                    return Err(ProvisionAttemptError::Conflict(reason));
                }
                Err(error) => return Err(error),
            };

        if inserted_mapping {
            return Ok(PrincipalProvisionResult {
                principal_id: inserted_user,
                retried: false,
            });
        }

        let resolved = self
            .query_principal_id(client, provider, subject)
            .await
            .map_err(ProvisionAttemptError::Retryable)?;

        if let Some(principal_id) = resolved {
            if principal_id != inserted_user {
                self.cleanup_orphan_user(client, inserted_user).await;
            }

            return Ok(PrincipalProvisionResult {
                principal_id,
                retried: true,
            });
        }

        self.cleanup_orphan_user(client, inserted_user).await;
        Err(ProvisionAttemptError::Conflict(
            "principal_mapping_conflict_unresolved".to_owned(),
        ))
    }
}

#[async_trait]
impl PrincipalStore for PostgresPrincipalStore {
    /// 永続ストアからprincipalを取得する。
    /// @param provider 認証プロバイダ
    /// @param subject 外部主体値
    /// @returns principal_id（存在時）
    /// @throws String ストア障害時
    async fn find_principal_id(
        &self,
        provider: &str,
        subject: &str,
    ) -> Result<Option<PrincipalId>, String> {
        let mut attempt = 0_u32;
        loop {
            let client = self.select_client().await?;
            match self.query_principal_id(&client, provider, subject).await {
                Ok(result) => return Ok(result),
                Err(error) => {
                    self.invalidate_pool().await;
                    if attempt >= self.max_retries {
                        return Err(error);
                    }

                    let delay = self.retry_delay(attempt);
                    warn!(
                        reason = %error,
                        provider = %provider,
                        subject = %subject,
                        attempt = attempt + 1,
                        max_retries = self.max_retries,
                        backoff_ms = delay.as_millis() as u64,
                        "postgres principal query failed; retrying with backoff"
                    );
                    tokio::time::sleep(delay).await;
                    attempt = attempt.saturating_add(1);
                }
            }
        }
    }

    /// 永続ストアでprincipalを冪等生成する。
    /// @param provider 認証プロバイダ
    /// @param subject 外部主体値
    /// @param request プロビジョニング要求
    /// @returns principal_id
    /// @throws PrincipalProvisionError 入力不正/競合/依存障害時
    async fn find_or_provision_principal_id(
        &self,
        provider: &str,
        subject: &str,
        request: &PrincipalProvisionRequest,
    ) -> Result<PrincipalProvisionResult, PrincipalProvisionError> {
        let mut attempt = 0_u32;
        loop {
            let client = self
                .select_client()
                .await
                .map_err(PrincipalProvisionError::DependencyUnavailable)?;

            match self.provision_once(&client, provider, subject, request).await {
                Ok(mut result) => {
                    if attempt > 0 {
                        result.retried = true;
                    }
                    return Ok(result);
                }
                Err(ProvisionAttemptError::InvalidInput(reason)) => {
                    return Err(PrincipalProvisionError::InvalidInput(reason));
                }
                Err(ProvisionAttemptError::Conflict(reason)) => {
                    return Err(PrincipalProvisionError::Conflict(reason));
                }
                Err(ProvisionAttemptError::Retryable(reason)) => {
                    self.invalidate_pool().await;
                    if attempt >= self.max_retries {
                        return Err(PrincipalProvisionError::DependencyUnavailable(reason));
                    }

                    let delay = self.retry_delay(attempt);
                    warn!(
                        reason = %reason,
                        provider = %provider,
                        subject = %subject,
                        attempt = attempt + 1,
                        max_retries = self.max_retries,
                        backoff_ms = delay.as_millis() as u64,
                        "postgres principal provision failed; retrying with backoff"
                    );
                    tokio::time::sleep(delay).await;
                    attempt = attempt.saturating_add(1);
                }
            }
        }
    }
}

/// 依存未構成時にfail-closeさせるprincipalストアを表現する。
#[derive(Clone)]
pub struct UnavailablePrincipalStore {
    reason: String,
}

impl UnavailablePrincipalStore {
    /// ストアを生成する。
    /// @param reason 障害理由
    /// @returns 依存未構成ストア
    /// @throws なし
    pub fn new(reason: impl Into<String>) -> Self {
        Self {
            reason: reason.into(),
        }
    }
}

#[async_trait]
impl PrincipalStore for UnavailablePrincipalStore {
    /// 常に依存障害として扱う。
    /// @param _provider 認証プロバイダ
    /// @param _subject 外部主体値
    /// @returns なし
    /// @throws String 常に依存障害
    async fn find_principal_id(
        &self,
        _provider: &str,
        _subject: &str,
    ) -> Result<Option<PrincipalId>, String> {
        Err(self.reason.clone())
    }

    /// 常に依存障害として扱う。
    /// @param _provider 認証プロバイダ
    /// @param _subject 外部主体値
    /// @param _request プロビジョニング要求
    /// @returns なし
    /// @throws PrincipalProvisionError 常に依存障害
    async fn find_or_provision_principal_id(
        &self,
        _provider: &str,
        _subject: &str,
        _request: &PrincipalProvisionRequest,
    ) -> Result<PrincipalProvisionResult, PrincipalProvisionError> {
        Err(PrincipalProvisionError::DependencyUnavailable(
            self.reason.clone(),
        ))
    }
}

/// 依存未構成時にfail-closeさせる検証器を表現する。
#[derive(Clone)]
pub struct UnavailableTokenVerifier {
    reason: String,
}

impl UnavailableTokenVerifier {
    /// 検証器を生成する。
    /// @param reason 障害理由
    /// @returns 依存未構成検証器
    /// @throws なし
    pub fn new(reason: impl Into<String>) -> Self {
        Self {
            reason: reason.into(),
        }
    }
}

#[async_trait]
impl TokenVerifier for UnavailableTokenVerifier {
    /// 常に依存障害として扱う。
    /// @param _token 入力トークン
    /// @returns なし
    /// @throws TokenVerifyError 常に依存障害
    async fn verify(&self, _token: &str) -> Result<VerifiedToken, TokenVerifyError> {
        Err(TokenVerifyError::DependencyUnavailable(self.reason.clone()))
    }
}

fn normalized_email(uid: &str, raw_email: Option<&str>) -> String {
    if let Some(email) = raw_email.map(str::trim).filter(|value| !value.is_empty()) {
        return email.to_ascii_lowercase();
    }

    let suffix = normalized_uid_fragment(uid);
    format!("firebase+{suffix}@provision.local.invalid")
}

fn normalized_display_name(uid: &str, raw_display_name: Option<&str>) -> String {
    if let Some(display_name) = raw_display_name
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        return display_name.to_owned();
    }

    let suffix = normalized_uid_fragment(uid)
        .chars()
        .take(12)
        .collect::<String>();
    format!("user-{suffix}")
}

fn normalized_uid_fragment(uid: &str) -> String {
    let mut fragment = String::with_capacity(uid.len());
    for ch in uid.chars() {
        if ch.is_ascii_alphanumeric() {
            fragment.push(ch.to_ascii_lowercase());
        } else if ch == '-' || ch == '_' {
            fragment.push(ch);
        } else {
            fragment.push('-');
        }
    }

    let compact = fragment.trim_matches('-');
    if compact.is_empty() {
        return "unknown".to_owned();
    }

    compact.to_owned()
}

fn is_email_unique_violation(error: &tokio_postgres::Error) -> bool {
    if error.code() != Some(&SqlState::UNIQUE_VIOLATION) {
        return false;
    }

    error
        .as_db_error()
        .and_then(|db_error| db_error.constraint())
        .map(|constraint| constraint == "uq_users_email_lower")
        .unwrap_or(false)
}
