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
    /// UIDからprincipal_idを解決する。
    /// @param uid Firebase UID
    /// @returns principal_id
    /// @throws PrincipalResolveError 未紐付け/依存障害時
    async fn resolve_principal_id(&self, uid: &str) -> Result<PrincipalId, PrincipalResolveError> {
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

        let principal_id = self
            .store
            .find_principal_id(&self.provider, uid)
            .await
            .map_err(PrincipalResolveError::DependencyUnavailable)?
            .ok_or(PrincipalResolveError::NotFound)?;

        if let Err(error) = self
            .cache
            .set(&self.provider, uid, principal_id, self.cache_ttl)
            .await
        {
            warn!(reason = %error, provider = %self.provider, uid = %uid, "failed to refresh principal cache");
        }

        Ok(principal_id)
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
}

impl Default for InMemoryPrincipalStore {
    fn default() -> Self {
        Self {
            entries: Arc::new(RwLock::new(HashMap::new())),
            available: Arc::new(AtomicBool::new(true)),
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
            }
        }

        Self {
            entries: Arc::new(RwLock::new(entries)),
            available: Arc::new(AtomicBool::new(true)),
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
}

/// Postgresのauth_identities参照を行う永続ストアを表現する。
#[derive(Clone)]
pub struct PostgresPrincipalStore {
    database_url: Arc<str>,
    clients: Arc<RwLock<Vec<Arc<tokio_postgres::Client>>>>,
    next_index: Arc<AtomicU64>,
    pool_size: usize,
}

impl PostgresPrincipalStore {
    /// Postgresストアを生成する。
    /// @param database_url 接続文字列
    /// @returns Postgres principalストア
    /// @throws なし
    pub fn new(database_url: String) -> Self {
        let pool_size = parse_env_u64("AUTH_PRINCIPAL_STORE_POOL_SIZE", 4).max(1) as usize;
        Self {
            database_url: Arc::from(database_url),
            clients: Arc::new(RwLock::new(Vec::new())),
            next_index: Arc::new(AtomicU64::new(0)),
            pool_size,
        }
    }

    /// Postgres接続を1本生成する。
    /// @param なし
    /// @returns Postgresクライアント
    /// @throws String 接続失敗時
    async fn connect_client(&self) -> Result<Arc<tokio_postgres::Client>, String> {
        let (client, connection) = tokio_postgres::connect(self.database_url.as_ref(), NoTls)
            .await
            .map_err(|error| format!("postgres_connect_failed:{error}"))?;

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
        let client = self.select_client().await?;
        match self.query_principal_id(&client, provider, subject).await {
            Ok(result) => Ok(result),
            Err(first_error) => {
                self.invalidate_pool().await;
                warn!(
                    reason = %first_error,
                    provider = %provider,
                    subject = %subject,
                    "postgres principal query failed; retrying with refreshed connection"
                );

                let retry_client = self.select_client().await?;
                self.query_principal_id(&retry_client, provider, subject)
                    .await
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
