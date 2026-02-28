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

/// principal生成境界を表現する。
#[async_trait]
pub trait PrincipalProvisioner: Send + Sync {
    /// 未解決UIDのprincipalを冪等生成する。
    /// @param provider 認証プロバイダ
    /// @param verified 検証済みトークン
    /// @returns 生成または既存のprincipal_id
    /// @throws PrincipalProvisionError 入力不正/競合/依存障害時
    async fn provision_principal_id(
        &self,
        provider: &str,
        verified: &VerifiedToken,
    ) -> Result<PrincipalId, PrincipalProvisionError>;
}

/// principal生成失敗を表現する。
#[derive(Debug, Clone)]
pub enum PrincipalProvisionError {
    InvalidInput(String),
    Conflict(String),
    DependencyUnavailable(String),
}

/// uid->principal解決のキャッシュ付き実装を表現する。
pub struct CachingPrincipalResolver {
    provider: String,
    cache: Arc<dyn PrincipalCache>,
    store: Arc<dyn PrincipalStore>,
    provisioner: Arc<dyn PrincipalProvisioner>,
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
        provisioner: Arc<dyn PrincipalProvisioner>,
        cache_ttl: Duration,
        metrics: Arc<AuthMetrics>,
    ) -> Self {
        Self {
            provider,
            cache,
            store,
            provisioner,
            cache_ttl,
            metrics,
        }
    }
}

#[async_trait]
impl PrincipalResolver for CachingPrincipalResolver {
    /// 検証済みトークンからprincipal_idを解決する。
    /// @param verified 検証済みトークン
    /// @returns principal_id
    /// @throws PrincipalResolveError 未紐付け/入力不正/競合/依存障害時
    async fn resolve_principal_id(
        &self,
        verified: &VerifiedToken,
    ) -> Result<PrincipalId, PrincipalResolveError> {
        let uid = verified.uid.as_str();

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
            .map_err(PrincipalResolveError::DependencyUnavailable)?;

        let principal_id = match principal_id {
            Some(principal_id) => principal_id,
            None => {
                let provisioned = self
                    .provisioner
                    .provision_principal_id(&self.provider, verified)
                    .await;

                match provisioned {
                    Ok(principal_id) => {
                        self.metrics.record_principal_provision_success();
                        tracing::info!(
                            provider = %self.provider,
                            uid = %uid,
                            principal_id = principal_id.0,
                            provision_action = "created_or_reused",
                            "principal provision succeeded"
                        );
                        principal_id
                    }
                    Err(error) => {
                        self.metrics.record_principal_provision_failure();
                        tracing::warn!(
                            provider = %self.provider,
                            uid = %uid,
                            error = ?error,
                            provision_action = "failed",
                            "principal provision failed"
                        );
                        return Err(match error {
                            PrincipalProvisionError::InvalidInput(reason) => {
                                PrincipalResolveError::InvalidInput(reason)
                            }
                            PrincipalProvisionError::Conflict(reason) => {
                                PrincipalResolveError::Conflict(reason)
                            }
                            PrincipalProvisionError::DependencyUnavailable(reason) => {
                                PrincipalResolveError::DependencyUnavailable(reason)
                            }
                        });
                    }
                }
            }
        };

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
#[cfg(test)]
#[derive(Clone)]
pub struct InMemoryPrincipalStore {
    entries: Arc<RwLock<HashMap<String, PrincipalId>>>,
    emails: Arc<RwLock<HashMap<String, PrincipalId>>>,
    next_principal_id: Arc<std::sync::atomic::AtomicI64>,
    available: Arc<AtomicBool>,
}

#[cfg(test)]
impl Default for InMemoryPrincipalStore {
    fn default() -> Self {
        Self {
            entries: Arc::new(RwLock::new(HashMap::new())),
            emails: Arc::new(RwLock::new(HashMap::new())),
            next_principal_id: Arc::new(std::sync::atomic::AtomicI64::new(10_000)),
            available: Arc::new(AtomicBool::new(true)),
        }
    }
}

#[cfg(test)]
impl InMemoryPrincipalStore {
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

    /// メール単位でprincipalを解決または採番する。
    /// @param email 正規化済みメール
    /// @returns principal_id
    /// @throws なし
    async fn resolve_or_create_principal_for_email(&self, email: &str) -> PrincipalId {
        {
            let guard = self.emails.read().await;
            if let Some(principal_id) = guard.get(email) {
                return *principal_id;
            }
        }

        let mut guard = self.emails.write().await;
        if let Some(principal_id) = guard.get(email) {
            return *principal_id;
        }

        let next_id = self.next_principal_id.fetch_add(1, Ordering::Relaxed);
        let principal_id = PrincipalId(next_id);
        guard.insert(email.to_owned(), principal_id);
        principal_id
    }
}

#[cfg(test)]
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

#[cfg(test)]
#[async_trait]
impl PrincipalProvisioner for InMemoryPrincipalStore {
    /// 未解決UIDのprincipalを冪等生成する。
    /// @param provider 認証プロバイダ
    /// @param verified 検証済みトークン
    /// @returns 生成または既存のprincipal_id
    /// @throws PrincipalProvisionError 入力不正/依存障害時
    async fn provision_principal_id(
        &self,
        provider: &str,
        verified: &VerifiedToken,
    ) -> Result<PrincipalId, PrincipalProvisionError> {
        if !self.available.load(Ordering::Relaxed) {
            return Err(PrincipalProvisionError::DependencyUnavailable(
                "principal_store_unavailable".to_owned(),
            ));
        }

        let uid_key = format!("{provider}:{}", verified.uid);
        {
            let entries = self.entries.read().await;
            if let Some(principal_id) = entries.get(&uid_key) {
                return Ok(*principal_id);
            }
        }

        let email = normalized_verified_email(verified)?;
        let principal_id = self.resolve_or_create_principal_for_email(&email).await;

        let mut entries = self.entries.write().await;
        if let Some(existing) = entries.get(&uid_key) {
            return Ok(*existing);
        }
        entries.insert(uid_key, principal_id);
        Ok(principal_id)
    }
}

/// 検証済みトークンから正規化メールを抽出する。
/// @param verified 検証済みトークン
/// @returns 正規化済みメール
/// @throws PrincipalProvisionError メール欠落または不正時
fn normalized_verified_email(
    verified: &VerifiedToken,
) -> Result<String, PrincipalProvisionError> {
    let email = verified
        .email
        .as_ref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| PrincipalProvisionError::InvalidInput("firebase_email_missing".to_owned()))?
        .to_ascii_lowercase();

    if !email.contains('@') {
        return Err(PrincipalProvisionError::InvalidInput(
            "firebase_email_invalid".to_owned(),
        ));
    }

    Ok(email)
}

/// 表示名をclaimまたはメールから導出する。
/// @param verified 検証済みトークン
/// @param email 正規化済みメール
/// @returns 表示名
/// @throws なし
fn derived_display_name(verified: &VerifiedToken, email: &str) -> String {
    if let Some(name) = verified
        .display_name
        .as_ref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
    {
        return name.chars().take(64).collect();
    }

    let local = email
        .split('@')
        .next()
        .filter(|value| !value.is_empty())
        .unwrap_or(verified.uid.as_str());
    local.chars().take(64).collect()
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
    metrics: Arc<AuthMetrics>,
}

#[derive(Clone, Copy)]
enum PostgresTransportSecurity {
    TlsRequiredFailClose,
    NoTlsAllowed,
}

impl PostgresPrincipalStore {
    /// Postgresストアを生成する。
    /// @param database_url 接続文字列
    /// @returns Postgres principalストア
    /// @throws なし
    pub fn new(database_url: String, metrics: Arc<AuthMetrics>) -> Self {
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
            metrics,
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

    /// メールで既存ユーザーを検索し、なければ作成してIDを返す。
    /// @param client Postgresクライアント
    /// @param email 正規化済みメール
    /// @param display_name 表示名
    /// @returns users.id
    /// @throws String クエリ失敗時
    async fn resolve_or_create_user_id(
        &self,
        client: &Arc<tokio_postgres::Client>,
        email: &str,
        display_name: &str,
    ) -> Result<PrincipalId, String> {
        let row = client
            .query_opt(
                "WITH inserted AS (
                    INSERT INTO users (email, display_name, theme)
                    VALUES ($1, $2, 'dark')
                    ON CONFLICT DO NOTHING
                    RETURNING id
                )
                SELECT id FROM inserted
                UNION ALL
                SELECT id FROM users WHERE lower(email) = lower($1)
                LIMIT 1",
                &[&email, &display_name],
            )
            .await
            .map_err(|error| format!("postgres_user_resolve_or_create_failed:{error}"))?;

        row.map(|row| PrincipalId(row.get::<usize, i64>(0)))
            .ok_or_else(|| "postgres_user_resolve_or_create_missing".to_owned())
    }

    /// uid->principalマッピングをupsertする。
    /// @param client Postgresクライアント
    /// @param provider 認証プロバイダ
    /// @param uid Firebase UID
    /// @param principal_id users.id
    /// @returns なし
    /// @throws String クエリ失敗時
    async fn upsert_principal_mapping(
        &self,
        client: &Arc<tokio_postgres::Client>,
        provider: &str,
        uid: &str,
        principal_id: PrincipalId,
    ) -> Result<(), String> {
        client
            .execute(
                "INSERT INTO auth_identities (provider, provider_subject, principal_id)
                 VALUES ($1, $2, $3)
                 ON CONFLICT DO NOTHING",
                &[&provider, &uid, &principal_id.0],
            )
            .await
            .map_err(|error| format!("postgres_auth_identity_upsert_failed:{error}"))?;
        Ok(())
    }

    /// provider/uidの現在マッピングを再取得する。
    /// @param client Postgresクライアント
    /// @param provider 認証プロバイダ
    /// @param uid Firebase UID
    /// @returns principal_id（存在時）
    /// @throws String クエリ失敗時
    async fn resolve_mapping_after_upsert(
        &self,
        client: &Arc<tokio_postgres::Client>,
        provider: &str,
        uid: &str,
    ) -> Result<Option<PrincipalId>, String> {
        self.query_principal_id(client, provider, uid).await
    }

    /// プロビジョニング入力を生成する。
    /// @param verified 検証済みトークン
    /// @returns 正規化済みメールと表示名
    /// @throws PrincipalProvisionError 入力不正時
    fn build_provisioning_input(
        &self,
        verified: &VerifiedToken,
    ) -> Result<(String, String), PrincipalProvisionError> {
        let email = normalized_verified_email(verified)?;
        let display_name = derived_display_name(verified, &email);
        Ok((email, display_name))
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
}

#[async_trait]
impl PrincipalProvisioner for PostgresPrincipalStore {
    /// 未解決UIDのprincipalを冪等生成する。
    /// @param provider 認証プロバイダ
    /// @param verified 検証済みトークン
    /// @returns 生成または既存のprincipal_id
    /// @throws PrincipalProvisionError 入力不正/競合/依存障害時
    async fn provision_principal_id(
        &self,
        provider: &str,
        verified: &VerifiedToken,
    ) -> Result<PrincipalId, PrincipalProvisionError> {
        let (email, display_name) = self.build_provisioning_input(verified)?;
        let mut attempt = 0_u32;

        loop {
            let result: Result<PrincipalId, PrincipalProvisionError> = async {
                let client = self
                    .select_client()
                    .await
                    .map_err(PrincipalProvisionError::DependencyUnavailable)?;

                if let Some(principal_id) = self
                    .query_principal_id(&client, provider, &verified.uid)
                    .await
                    .map_err(PrincipalProvisionError::DependencyUnavailable)?
                {
                    return Ok(principal_id);
                }

                let user_id = self
                    .resolve_or_create_user_id(&client, &email, &display_name)
                    .await
                    .map_err(PrincipalProvisionError::DependencyUnavailable)?;

                self.upsert_principal_mapping(&client, provider, &verified.uid, user_id)
                    .await
                    .map_err(PrincipalProvisionError::DependencyUnavailable)?;

                let resolved = self
                    .resolve_mapping_after_upsert(&client, provider, &verified.uid)
                    .await
                    .map_err(PrincipalProvisionError::DependencyUnavailable)?
                    .ok_or_else(|| {
                        PrincipalProvisionError::Conflict(
                            "principal_provision_conflict".to_owned(),
                        )
                    })?;

                if resolved != user_id {
                    return Err(PrincipalProvisionError::Conflict(
                        "principal_provision_conflict".to_owned(),
                    ));
                }

                Ok(resolved)
            }
            .await;

            match result {
                Ok(principal_id) => return Ok(principal_id),
                Err(PrincipalProvisionError::DependencyUnavailable(error)) => {
                    self.invalidate_pool().await;
                    if attempt >= self.max_retries {
                        return Err(PrincipalProvisionError::DependencyUnavailable(error));
                    }

                    self.metrics.record_principal_provision_retry();
                    let delay = self.retry_delay(attempt);
                    warn!(
                        reason = %error,
                        provider = %provider,
                        uid = %verified.uid,
                        email = %email,
                        attempt = attempt + 1,
                        max_retries = self.max_retries,
                        backoff_ms = delay.as_millis() as u64,
                        "principal provisioning dependency failure; retrying"
                    );
                    tokio::time::sleep(delay).await;
                    attempt = attempt.saturating_add(1);
                }
                Err(error) => return Err(error),
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

/// 依存未構成時にfail-closeさせるprincipal生成器を表現する。
#[derive(Clone)]
pub struct UnavailablePrincipalProvisioner {
    reason: String,
}

impl UnavailablePrincipalProvisioner {
    /// 生成器を生成する。
    /// @param reason 障害理由
    /// @returns 依存未構成生成器
    /// @throws なし
    pub fn new(reason: impl Into<String>) -> Self {
        Self {
            reason: reason.into(),
        }
    }
}

#[async_trait]
impl PrincipalProvisioner for UnavailablePrincipalProvisioner {
    /// 常に依存障害として扱う。
    /// @param _provider 認証プロバイダ
    /// @param _verified 検証済みトークン
    /// @returns なし
    /// @throws PrincipalProvisionError 常に依存障害
    async fn provision_principal_id(
        &self,
        _provider: &str,
        _verified: &VerifiedToken,
    ) -> Result<PrincipalId, PrincipalProvisionError> {
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
