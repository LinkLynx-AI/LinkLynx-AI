/// Firebase認証設定を保持する。
#[derive(Debug, Clone)]
pub struct FirebaseAuthConfig {
    pub audience: String,
    pub issuer: String,
    pub jwks_url: String,
    pub jwks_ttl: Duration,
    pub http_timeout: Duration,
}

impl FirebaseAuthConfig {
    /// 環境変数からFirebase設定を組み立てる。
    /// @param なし
    /// @returns Firebase設定
    /// @throws String 必須設定欠落時
    pub fn from_env() -> Result<Self, String> {
        let project_id =
            env::var("FIREBASE_PROJECT_ID").map_err(|_| "FIREBASE_PROJECT_ID is required")?;
        let audience = env::var("FIREBASE_AUDIENCE").unwrap_or_else(|_| project_id.clone());
        let issuer = env::var("FIREBASE_ISSUER")
            .unwrap_or_else(|_| format!("https://securetoken.google.com/{project_id}"));
        let jwks_url =
            env::var("FIREBASE_JWKS_URL").unwrap_or_else(|_| DEFAULT_JWKS_URL.to_owned());
        let jwks_ttl = Duration::from_secs(parse_env_u64("FIREBASE_JWKS_TTL_SECONDS", 300));
        let http_timeout = Duration::from_secs(parse_env_u64("FIREBASE_HTTP_TIMEOUT_SECONDS", 5));

        Ok(Self {
            audience,
            issuer,
            jwks_url,
            jwks_ttl,
            http_timeout,
        })
    }
}

/// Firebase JWTをローカル検証する実装を表現する。
#[derive(Clone)]
pub struct FirebaseTokenVerifier {
    config: FirebaseAuthConfig,
    jwks_cache: JwksCache,
}

impl FirebaseTokenVerifier {
    /// 検証器を生成する。
    /// @param config Firebase設定
    /// @returns Firebase検証器
    /// @throws なし
    pub fn new(config: FirebaseAuthConfig) -> Self {
        let client = Client::builder()
            .timeout(config.http_timeout)
            .build()
            .unwrap_or_else(|error| {
                warn!(reason = %error, "reqwest client fallback to default");
                Client::new()
            });

        Self {
            config: config.clone(),
            jwks_cache: JwksCache::new(client, config.jwks_url, config.jwks_ttl),
        }
    }
}

#[async_trait]
impl TokenVerifier for FirebaseTokenVerifier {
    /// Firebase IDトークンを検証する。
    /// @param token Firebase IDトークン
    /// @returns 検証済みトークン
    /// @throws TokenVerifyError 署名/クレーム不整合時
    async fn verify(&self, token: &str) -> Result<VerifiedToken, TokenVerifyError> {
        let header = jsonwebtoken::decode_header(token)
            .map_err(|_| TokenVerifyError::Invalid("jwt_header_invalid"))?;
        let kid = header
            .kid
            .ok_or(TokenVerifyError::Invalid("jwt_kid_missing"))?;
        let decoding_key = self.jwks_cache.key_for(&kid).await?;

        let mut validation = Validation::new(Algorithm::RS256);
        validation.validate_exp = true;
        validation.set_audience(&[self.config.audience.as_str()]);
        validation.set_issuer(&[self.config.issuer.as_str()]);

        let token_data = jsonwebtoken::decode::<FirebaseClaims>(token, &decoding_key, &validation)
            .map_err(map_jwt_error)?;

        if token_data.claims.sub.is_empty() {
            return Err(TokenVerifyError::Invalid("jwt_sub_missing"));
        }

        let now = unix_timestamp_seconds();
        if token_data.claims.iat > now.saturating_add(60) {
            return Err(TokenVerifyError::Invalid("jwt_iat_in_future"));
        }

        Ok(VerifiedToken {
            uid: token_data.claims.sub,
            expires_at_epoch: token_data.claims.exp,
        })
    }
}

#[derive(Debug, Deserialize)]
struct FirebaseClaims {
    sub: String,
    exp: u64,
    iat: u64,
}

#[derive(Debug, Deserialize)]
struct JwksResponse {
    keys: Vec<JwkRsaKey>,
}

#[derive(Debug, Clone, Deserialize)]
struct JwkRsaKey {
    kid: String,
    kty: String,
    n: String,
    e: String,
}

#[derive(Debug, Default)]
struct JwksCacheState {
    fetched_at: Option<Instant>,
    keys: HashMap<String, JwkRsaKey>,
    missing_kid_refresh_at: HashMap<String, Instant>,
    last_global_missing_kid_refresh_at: Option<Instant>,
    last_refresh_unavailable_at: Option<Instant>,
}

enum CachedKeyLookup {
    Hit(DecodingKey),
    MissingFresh,
    Stale,
}

#[derive(Clone)]
struct JwksCache {
    client: Client,
    url: String,
    ttl: Duration,
    state: Arc<RwLock<JwksCacheState>>,
    refresh_lock: Arc<Mutex<()>>,
    missing_kid_refresh_backoff: Duration,
}

impl JwksCache {
    /// JWKSキャッシュを生成する。
    /// @param client HTTPクライアント
    /// @param url JWKS取得URL
    /// @param ttl キャッシュTTL
    /// @returns JWKSキャッシュ
    /// @throws なし
    fn new(client: Client, url: String, ttl: Duration) -> Self {
        Self {
            client,
            url,
            ttl,
            state: Arc::new(RwLock::new(JwksCacheState::default())),
            refresh_lock: Arc::new(Mutex::new(())),
            missing_kid_refresh_backoff: Duration::from_secs(
                DEFAULT_MISSING_KID_REFRESH_BACKOFF_SECONDS,
            ),
        }
    }

    /// kidに対応する復号鍵を返す。
    /// @param kid JWTヘッダーのkid
    /// @returns 検証用DecodingKey
    /// @throws TokenVerifyError JWKS取得失敗/未知kid時
    async fn key_for(&self, kid: &str) -> Result<DecodingKey, TokenVerifyError> {
        match self.try_get_cached_key(kid).await? {
            CachedKeyLookup::Hit(key) => Ok(key),
            CachedKeyLookup::MissingFresh => self.refresh_and_get(kid, true).await,
            CachedKeyLookup::Stale => {
                if !self.can_attempt_stale_refresh().await {
                    return self.missing_kid_backoff_error().await;
                }
                self.refresh_and_get(kid, false).await
            }
        }
    }

    /// refresh後にkid対応鍵を再取得する。
    /// @param kid JWTヘッダーのkid
    /// @param from_fresh_miss fresh cacheでkid不一致から来たか
    /// @returns 検証用DecodingKey
    /// @throws TokenVerifyError JWKS取得失敗/未知kid時
    async fn refresh_and_get(
        &self,
        kid: &str,
        from_fresh_miss: bool,
    ) -> Result<DecodingKey, TokenVerifyError> {
        let _guard = self.refresh_lock.lock().await;

        match self.try_get_cached_key(kid).await? {
            CachedKeyLookup::Hit(key) => return Ok(key),
            CachedKeyLookup::MissingFresh => {
                if !from_fresh_miss {
                    return Err(TokenVerifyError::Invalid("jwks_kid_not_found"));
                }

                if !self.can_force_refresh_on_missing_kid(kid).await {
                    return self.missing_kid_backoff_error().await;
                }

                if !self.can_force_global_missing_kid_refresh().await {
                    return self.missing_kid_backoff_error().await;
                }

                self.mark_missing_kid_refresh_attempt(kid).await;
            }
            CachedKeyLookup::Stale => {
                if !from_fresh_miss && !self.can_attempt_stale_refresh().await {
                    return self.missing_kid_backoff_error().await;
                }
            }
        }

        match self.refresh().await {
            Ok(()) => {
                self.mark_refresh_success().await;
            }
            Err(error) => {
                if matches!(error, TokenVerifyError::DependencyUnavailable(_)) {
                    self.mark_refresh_unavailable().await;
                }
                return Err(error);
            }
        }

        self.try_get_cached_key(kid)
            .await
            .and_then(|lookup| match lookup {
                CachedKeyLookup::Hit(key) => Ok(key),
                CachedKeyLookup::MissingFresh | CachedKeyLookup::Stale => {
                    Err(TokenVerifyError::Invalid("jwks_kid_not_found"))
                }
            })
    }

    /// fresh-miss時にrefreshを強制可能か判定する。
    /// @param なし
    /// @returns refresh強制可否
    /// @throws なし
    async fn can_force_refresh_on_missing_kid(&self, kid: &str) -> bool {
        let mut state = self.state.write().await;
        state
            .missing_kid_refresh_at
            .retain(|_, last| last.elapsed() < self.missing_kid_refresh_backoff);
        !state.missing_kid_refresh_at.contains_key(kid)
    }

    /// stale時にrefreshを試行可能か判定する。
    /// @param なし
    /// @returns refresh試行可否
    /// @throws なし
    async fn can_attempt_stale_refresh(&self) -> bool {
        let state = self.state.read().await;
        state
            .last_refresh_unavailable_at
            .map(|last| last.elapsed() >= self.missing_kid_refresh_backoff)
            .unwrap_or(true)
    }

    /// fresh-miss時にグローバルrefreshを強制可能か判定する。
    /// @param なし
    /// @returns refresh強制可否
    /// @throws なし
    async fn can_force_global_missing_kid_refresh(&self) -> bool {
        let state = self.state.read().await;
        state
            .last_global_missing_kid_refresh_at
            .map(|last| last.elapsed() >= self.missing_kid_refresh_backoff)
            .unwrap_or(true)
    }

    /// fresh-miss時の強制refresh時刻を記録する。
    /// @param なし
    /// @returns なし
    /// @throws なし
    async fn mark_missing_kid_refresh_attempt(&self, kid: &str) {
        let mut state = self.state.write().await;
        let now = Instant::now();
        state.missing_kid_refresh_at.insert(kid.to_owned(), now);
        state.last_global_missing_kid_refresh_at = Some(now);
    }

    /// refresh成功を記録する。
    /// @param なし
    /// @returns なし
    /// @throws なし
    async fn mark_refresh_success(&self) {
        let mut state = self.state.write().await;
        state.last_refresh_unavailable_at = None;
    }

    /// refresh依存障害を記録する。
    /// @param なし
    /// @returns なし
    /// @throws なし
    async fn mark_refresh_unavailable(&self) {
        let mut state = self.state.write().await;
        state.last_refresh_unavailable_at = Some(Instant::now());
    }

    /// backoff中のmissing-kidに返すエラーを判定する。
    /// @param なし
    /// @returns 認証エラー
    /// @throws なし
    async fn missing_kid_backoff_error(&self) -> Result<DecodingKey, TokenVerifyError> {
        let state = self.state.read().await;
        let unavailable_recent = state
            .last_refresh_unavailable_at
            .map(|last| last.elapsed() < self.missing_kid_refresh_backoff)
            .unwrap_or(false);

        if unavailable_recent {
            Err(TokenVerifyError::DependencyUnavailable(
                "jwks_refresh_backoff_unavailable".to_owned(),
            ))
        } else {
            Err(TokenVerifyError::Invalid("jwks_kid_not_found"))
        }
    }

    /// キャッシュ済み鍵を取得する。
    /// @param kid JWTヘッダーのkid
    /// @returns 鍵（存在時）
    /// @throws TokenVerifyError JWK形式不正時
    async fn try_get_cached_key(&self, kid: &str) -> Result<CachedKeyLookup, TokenVerifyError> {
        let state = self.state.read().await;
        let is_fresh = state
            .fetched_at
            .map(|fetched_at| fetched_at.elapsed() < self.ttl)
            .unwrap_or(false);

        if !is_fresh {
            return Ok(CachedKeyLookup::Stale);
        }

        match state.keys.get(kid) {
            Some(key) => DecodingKey::from_rsa_components(&key.n, &key.e)
                .map(CachedKeyLookup::Hit)
                .map_err(|_| TokenVerifyError::Invalid("jwks_key_invalid")),
            None => Ok(CachedKeyLookup::MissingFresh),
        }
    }

    /// JWKSを再取得してキャッシュ更新する。
    /// @param なし
    /// @returns なし
    /// @throws TokenVerifyError 依存障害時
    async fn refresh(&self) -> Result<(), TokenVerifyError> {
        let response = self.client.get(&self.url).send().await.map_err(|error| {
            TokenVerifyError::DependencyUnavailable(format!("jwks_request_failed:{error}"))
        })?;

        if !response.status().is_success() {
            return Err(TokenVerifyError::DependencyUnavailable(format!(
                "jwks_response_not_success:{}",
                response.status()
            )));
        }

        let jwks = response.json::<JwksResponse>().await.map_err(|error| {
            TokenVerifyError::DependencyUnavailable(format!("jwks_decode_failed:{error}"))
        })?;

        let mut keys = HashMap::new();
        for key in jwks.keys {
            if key.kty != "RSA" {
                continue;
            }
            keys.insert(key.kid.clone(), key);
        }

        if keys.is_empty() {
            return Err(TokenVerifyError::DependencyUnavailable(
                "jwks_empty".to_owned(),
            ));
        }

        let mut state = self.state.write().await;
        state.keys = keys;
        state.fetched_at = Some(Instant::now());
        Ok(())
    }
}

fn map_jwt_error(error: jsonwebtoken::errors::Error) -> TokenVerifyError {
    if matches!(error.kind(), ErrorKind::ExpiredSignature) {
        TokenVerifyError::Expired
    } else {
        TokenVerifyError::Invalid("jwt_validation_failed")
    }
}
