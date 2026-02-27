use std::{
    collections::HashMap,
    env,
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc,
    },
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

use async_trait::async_trait;
use axum::{
    http::{header::AUTHORIZATION, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use jsonwebtoken::{errors::ErrorKind, Algorithm, DecodingKey, Validation};
use linklynx_shared::PrincipalId;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tokio::sync::{Mutex, RwLock};
use tokio_postgres::NoTls;
use tracing::warn;
use uuid::Uuid;

const FIREBASE_PROVIDER: &str = "firebase";
const DEFAULT_JWKS_URL: &str =
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const DEFAULT_MISSING_KID_REFRESH_BACKOFF_SECONDS: u64 = 30;

/// 認証済み主体情報を保持する。
/// @param principal_id 業務主体ID
/// @param firebase_uid Firebase UID
/// @param expires_at_epoch JWT有効期限(UNIX秒)
/// @returns 認証済みセッション情報
/// @throws なし
#[derive(Debug, Clone)]
pub struct AuthenticatedPrincipal {
    pub principal_id: PrincipalId,
    pub firebase_uid: String,
    pub expires_at_epoch: u64,
}

/// リクエスト文脈に注入する認証情報を保持する。
/// @param request_id リクエスト追跡ID
/// @param principal_id 業務主体ID
/// @param firebase_uid Firebase UID
/// @returns RESTハンドラに注入される認証文脈
/// @throws なし
#[derive(Debug, Clone)]
pub struct AuthContext {
    pub request_id: String,
    pub principal_id: PrincipalId,
    pub firebase_uid: String,
}

/// 認証エラー種別を表現する。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AuthErrorKind {
    MissingToken,
    InvalidToken,
    ExpiredToken,
    PrincipalNotMapped,
    DependencyUnavailable,
}

/// 認証処理の失敗内容を保持する。
#[derive(Debug, Clone)]
pub struct AuthError {
    pub kind: AuthErrorKind,
    pub reason: String,
}

impl AuthError {
    /// トークン欠落エラーを生成する。
    /// @param なし
    /// @returns トークン欠落エラー
    /// @throws なし
    pub fn missing_token() -> Self {
        Self {
            kind: AuthErrorKind::MissingToken,
            reason: "authorization_header_missing".to_owned(),
        }
    }

    /// トークン不正エラーを生成する。
    /// @param reason 失敗理由
    /// @returns トークン不正エラー
    /// @throws なし
    pub fn invalid_token(reason: impl Into<String>) -> Self {
        Self {
            kind: AuthErrorKind::InvalidToken,
            reason: reason.into(),
        }
    }

    /// 期限切れエラーを生成する。
    /// @param reason 失敗理由
    /// @returns 期限切れエラー
    /// @throws なし
    pub fn expired(reason: impl Into<String>) -> Self {
        Self {
            kind: AuthErrorKind::ExpiredToken,
            reason: reason.into(),
        }
    }

    /// 主体未解決エラーを生成する。
    /// @param reason 失敗理由
    /// @returns 主体未解決エラー
    /// @throws なし
    pub fn principal_not_mapped(reason: impl Into<String>) -> Self {
        Self {
            kind: AuthErrorKind::PrincipalNotMapped,
            reason: reason.into(),
        }
    }

    /// 依存障害エラーを生成する。
    /// @param reason 失敗理由
    /// @returns 依存障害エラー
    /// @throws なし
    pub fn dependency_unavailable(reason: impl Into<String>) -> Self {
        Self {
            kind: AuthErrorKind::DependencyUnavailable,
            reason: reason.into(),
        }
    }

    /// REST応答ステータスへマッピングする。
    /// @param なし
    /// @returns HTTPステータス
    /// @throws なし
    pub fn status_code(&self) -> StatusCode {
        match self.kind {
            AuthErrorKind::MissingToken
            | AuthErrorKind::InvalidToken
            | AuthErrorKind::ExpiredToken => StatusCode::UNAUTHORIZED,
            AuthErrorKind::PrincipalNotMapped => StatusCode::FORBIDDEN,
            AuthErrorKind::DependencyUnavailable => StatusCode::SERVICE_UNAVAILABLE,
        }
    }

    /// アプリケーションエラーコードへマッピングする。
    /// @param なし
    /// @returns エラーコード文字列
    /// @throws なし
    pub fn app_code(&self) -> &'static str {
        match self.kind {
            AuthErrorKind::MissingToken => "AUTH_MISSING_TOKEN",
            AuthErrorKind::InvalidToken => "AUTH_INVALID_TOKEN",
            AuthErrorKind::ExpiredToken => "AUTH_TOKEN_EXPIRED",
            AuthErrorKind::PrincipalNotMapped => "AUTH_PRINCIPAL_NOT_MAPPED",
            AuthErrorKind::DependencyUnavailable => "AUTH_UNAVAILABLE",
        }
    }

    /// 外部向けの固定メッセージを返す。
    /// @param なし
    /// @returns 公開用メッセージ
    /// @throws なし
    pub fn public_message(&self) -> &'static str {
        match self.kind {
            AuthErrorKind::MissingToken => "authentication token is required",
            AuthErrorKind::InvalidToken => "authentication token is invalid",
            AuthErrorKind::ExpiredToken => "authentication token is expired",
            AuthErrorKind::PrincipalNotMapped => "principal mapping is not found",
            AuthErrorKind::DependencyUnavailable => "authentication dependency is unavailable",
        }
    }

    /// WSクローズコードへマッピングする。
    /// @param なし
    /// @returns WebSocketクローズコード
    /// @throws なし
    pub fn ws_close_code(&self) -> u16 {
        match self.kind {
            AuthErrorKind::DependencyUnavailable => 1011,
            _ => 1008,
        }
    }

    /// ログ向け分類名を返す。
    /// @param なし
    /// @returns ログ分類ラベル
    /// @throws なし
    pub fn log_class(&self) -> &'static str {
        match self.kind {
            AuthErrorKind::MissingToken => "missing_token",
            AuthErrorKind::InvalidToken => "invalid_token",
            AuthErrorKind::ExpiredToken => "expired_token",
            AuthErrorKind::PrincipalNotMapped => "principal_not_mapped",
            AuthErrorKind::DependencyUnavailable => "dependency_unavailable",
        }
    }

    /// 認証判定ログのdecision値を返す。
    /// @param なし
    /// @returns decision値
    /// @throws なし
    pub fn decision(&self) -> &'static str {
        match self.kind {
            AuthErrorKind::DependencyUnavailable => "unavailable",
            _ => "deny",
        }
    }
}

#[derive(Debug, Serialize)]
struct AuthErrorBody {
    code: &'static str,
    message: String,
    request_id: String,
}

/// 認証エラーをHTTPレスポンスへ変換する。
/// @param error 認証エラー
/// @param request_id リクエスト追跡ID
/// @returns RESTエラーレスポンス
/// @throws なし
pub fn auth_error_response(error: &AuthError, request_id: String) -> Response {
    let body = AuthErrorBody {
        code: error.app_code(),
        message: error.public_message().to_owned(),
        request_id,
    };

    (error.status_code(), Json(body)).into_response()
}

/// ヘッダーからBearerトークンを抽出する。
/// @param headers HTTPヘッダー
/// @returns Bearerトークン
/// @throws AuthError Authorizationヘッダー欠落/形式不正
pub fn bearer_token_from_headers(headers: &HeaderMap) -> Result<String, AuthError> {
    let header_value = headers
        .get(AUTHORIZATION)
        .ok_or_else(AuthError::missing_token)?
        .to_str()
        .map_err(|_| AuthError::invalid_token("authorization_header_not_utf8"))?;

    let (scheme, token) = header_value
        .split_once(' ')
        .ok_or_else(|| AuthError::invalid_token("authorization_scheme_invalid"))?;

    if !scheme.eq_ignore_ascii_case("bearer") {
        return Err(AuthError::invalid_token("authorization_scheme_invalid"));
    }

    let trimmed = token.trim();
    if trimmed.is_empty() {
        return Err(AuthError::missing_token());
    }

    Ok(trimmed.to_owned())
}

/// ヘッダー由来または新規のrequest_idを返す。
/// @param headers HTTPヘッダー
/// @returns request_id
/// @throws なし
pub fn request_id_from_headers(headers: &HeaderMap) -> String {
    headers
        .get("x-request-id")
        .and_then(|value| value.to_str().ok())
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| Uuid::new_v4().to_string())
}

/// 認証メトリクスを保持する。
#[derive(Default)]
pub struct AuthMetrics {
    token_verify_success_total: AtomicU64,
    token_verify_failure_total: AtomicU64,
    token_verify_unavailable_total: AtomicU64,
    token_verify_latency_ms_total: AtomicU64,
    token_verify_latency_samples: AtomicU64,
    principal_cache_hit_total: AtomicU64,
    principal_cache_miss_total: AtomicU64,
    ws_reauth_success_total: AtomicU64,
    ws_reauth_failure_total: AtomicU64,
}

/// メトリクス出力スナップショットを保持する。
#[derive(Debug, Serialize)]
pub struct AuthMetricsSnapshot {
    pub token_verify_success_total: u64,
    pub token_verify_failure_total: u64,
    pub token_verify_unavailable_total: u64,
    pub token_verify_latency_avg_ms: f64,
    pub principal_cache_hit_total: u64,
    pub principal_cache_miss_total: u64,
    pub principal_cache_hit_ratio: f64,
    pub ws_reauth_success_total: u64,
    pub ws_reauth_failure_total: u64,
}

impl AuthMetrics {
    /// トークン検証結果を記録する。
    /// @param result 検証結果
    /// @param elapsed 検証時間
    /// @returns なし
    /// @throws なし
    pub fn record_token_verify(&self, result: TokenVerifyResult, elapsed: Duration) {
        let elapsed_ms = elapsed.as_millis().min(u64::MAX as u128) as u64;
        self.token_verify_latency_ms_total
            .fetch_add(elapsed_ms, Ordering::Relaxed);
        self.token_verify_latency_samples
            .fetch_add(1, Ordering::Relaxed);

        match result {
            TokenVerifyResult::Success => {
                self.token_verify_success_total
                    .fetch_add(1, Ordering::Relaxed);
            }
            TokenVerifyResult::Failure => {
                self.token_verify_failure_total
                    .fetch_add(1, Ordering::Relaxed);
            }
            TokenVerifyResult::Unavailable => {
                self.token_verify_unavailable_total
                    .fetch_add(1, Ordering::Relaxed);
            }
        }
    }

    /// principal解決時のキャッシュ利用結果を記録する。
    /// @param hit キャッシュヒット有無
    /// @returns なし
    /// @throws なし
    pub fn record_principal_cache(&self, hit: bool) {
        if hit {
            self.principal_cache_hit_total
                .fetch_add(1, Ordering::Relaxed);
        } else {
            self.principal_cache_miss_total
                .fetch_add(1, Ordering::Relaxed);
        }
    }

    /// WS再認証結果を記録する。
    /// @param success 成功可否
    /// @returns なし
    /// @throws なし
    pub fn record_ws_reauth(&self, success: bool) {
        if success {
            self.ws_reauth_success_total.fetch_add(1, Ordering::Relaxed);
        } else {
            self.ws_reauth_failure_total.fetch_add(1, Ordering::Relaxed);
        }
    }

    /// 現在メトリクスのスナップショットを返す。
    /// @param なし
    /// @returns メトリクススナップショット
    /// @throws なし
    pub fn snapshot(&self) -> AuthMetricsSnapshot {
        let latency_total = self.token_verify_latency_ms_total.load(Ordering::Relaxed) as f64;
        let latency_samples = self.token_verify_latency_samples.load(Ordering::Relaxed) as f64;
        let cache_hit = self.principal_cache_hit_total.load(Ordering::Relaxed) as f64;
        let cache_miss = self.principal_cache_miss_total.load(Ordering::Relaxed) as f64;
        let cache_total = cache_hit + cache_miss;

        AuthMetricsSnapshot {
            token_verify_success_total: self.token_verify_success_total.load(Ordering::Relaxed),
            token_verify_failure_total: self.token_verify_failure_total.load(Ordering::Relaxed),
            token_verify_unavailable_total: self
                .token_verify_unavailable_total
                .load(Ordering::Relaxed),
            token_verify_latency_avg_ms: if latency_samples > 0.0 {
                latency_total / latency_samples
            } else {
                0.0
            },
            principal_cache_hit_total: cache_hit as u64,
            principal_cache_miss_total: cache_miss as u64,
            principal_cache_hit_ratio: if cache_total > 0.0 {
                cache_hit / cache_total
            } else {
                0.0
            },
            ws_reauth_success_total: self.ws_reauth_success_total.load(Ordering::Relaxed),
            ws_reauth_failure_total: self.ws_reauth_failure_total.load(Ordering::Relaxed),
        }
    }
}

/// トークン検証メトリクス分類を表現する。
#[derive(Debug, Clone, Copy)]
pub enum TokenVerifyResult {
    Success,
    Failure,
    Unavailable,
}

/// トークン検証責務の境界を表現する。
#[async_trait]
pub trait TokenVerifier: Send + Sync {
    /// IDトークンを検証する。
    /// @param token Firebase IDトークン
    /// @returns 検証済みトークン情報
    /// @throws TokenVerifyError トークン不正/依存障害時
    async fn verify(&self, token: &str) -> Result<VerifiedToken, TokenVerifyError>;
}

/// principal解決責務の境界を表現する。
#[async_trait]
pub trait PrincipalResolver: Send + Sync {
    /// UIDからprincipal_idを解決する。
    /// @param uid Firebase UID
    /// @returns principal_id
    /// @throws PrincipalResolveError 未紐付け/依存障害時
    async fn resolve_principal_id(&self, uid: &str) -> Result<PrincipalId, PrincipalResolveError>;
}

/// トークン検証済み情報を保持する。
#[derive(Debug, Clone)]
pub struct VerifiedToken {
    pub uid: String,
    pub expires_at_epoch: u64,
}

/// トークン検証失敗を表現する。
#[derive(Debug, Clone)]
pub enum TokenVerifyError {
    Invalid(&'static str),
    Expired,
    DependencyUnavailable(String),
}

/// principal解決失敗を表現する。
#[derive(Debug, Clone)]
pub enum PrincipalResolveError {
    NotFound,
    DependencyUnavailable(String),
}

/// REST/WS共通の認証サービスを表現する。
#[derive(Clone)]
pub struct AuthService {
    verifier: Arc<dyn TokenVerifier>,
    resolver: Arc<dyn PrincipalResolver>,
    metrics: Arc<AuthMetrics>,
}

impl AuthService {
    /// 認証サービスを生成する。
    /// @param verifier トークン検証器
    /// @param resolver principal解決器
    /// @param metrics メトリクス集計器
    /// @returns 認証サービス
    /// @throws なし
    pub fn new(
        verifier: Arc<dyn TokenVerifier>,
        resolver: Arc<dyn PrincipalResolver>,
        metrics: Arc<AuthMetrics>,
    ) -> Self {
        Self {
            verifier,
            resolver,
            metrics,
        }
    }

    /// トークンから認証済み主体を解決する。
    /// @param token Bearerトークン文字列
    /// @returns 認証済み主体情報
    /// @throws AuthError 認証失敗時
    pub async fn authenticate_token(
        &self,
        token: &str,
    ) -> Result<AuthenticatedPrincipal, AuthError> {
        let started = Instant::now();
        let verified = self.verifier.verify(token).await;
        let elapsed = started.elapsed();

        let verified = match verified {
            Ok(verified) => {
                self.metrics
                    .record_token_verify(TokenVerifyResult::Success, elapsed);
                verified
            }
            Err(TokenVerifyError::Invalid(reason)) => {
                self.metrics
                    .record_token_verify(TokenVerifyResult::Failure, elapsed);
                return Err(AuthError::invalid_token(reason));
            }
            Err(TokenVerifyError::Expired) => {
                self.metrics
                    .record_token_verify(TokenVerifyResult::Failure, elapsed);
                return Err(AuthError::expired("token_expired"));
            }
            Err(TokenVerifyError::DependencyUnavailable(reason)) => {
                self.metrics
                    .record_token_verify(TokenVerifyResult::Unavailable, elapsed);
                return Err(AuthError::dependency_unavailable(reason));
            }
        };

        let principal_id = self
            .resolver
            .resolve_principal_id(&verified.uid)
            .await
            .map_err(|error| match error {
                PrincipalResolveError::NotFound => {
                    AuthError::principal_not_mapped("principal_mapping_missing")
                }
                PrincipalResolveError::DependencyUnavailable(reason) => {
                    AuthError::dependency_unavailable(reason)
                }
            })?;

        Ok(AuthenticatedPrincipal {
            principal_id,
            firebase_uid: verified.uid,
            expires_at_epoch: verified.expires_at_epoch,
        })
    }

    /// メトリクス参照を返す。
    /// @param なし
    /// @returns メトリクス参照
    /// @throws なし
    pub fn metrics(&self) -> Arc<AuthMetrics> {
        Arc::clone(&self.metrics)
    }
}

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

/// 実行時向けのAuthServiceを生成する。
/// @param metrics メトリクス集計器
/// @returns 認証サービス
/// @throws なし
pub fn build_runtime_auth_service(metrics: Arc<AuthMetrics>) -> AuthService {
    let verifier: Arc<dyn TokenVerifier> = match FirebaseAuthConfig::from_env() {
        Ok(config) => Arc::new(FirebaseTokenVerifier::new(config)),
        Err(reason) => {
            warn!(reason = %reason, "firebase auth config missing; authentication will fail-close");
            Arc::new(UnavailableTokenVerifier::new("firebase_config_missing"))
        }
    };

    let principal_store = build_runtime_principal_store();
    let principal_cache = InMemoryPrincipalCache::default();
    let cache_ttl_seconds = parse_env_u64("AUTH_PRINCIPAL_CACHE_TTL_SECONDS", 300);

    let resolver: Arc<dyn PrincipalResolver> = Arc::new(CachingPrincipalResolver::new(
        FIREBASE_PROVIDER.to_owned(),
        Arc::new(principal_cache),
        principal_store,
        Duration::from_secs(cache_ttl_seconds),
        Arc::clone(&metrics),
    ));

    AuthService::new(verifier, resolver, metrics)
}

/// 実行時向けのprincipalストアを生成する。
/// @param なし
/// @returns principalストア実装
/// @throws なし
fn build_runtime_principal_store() -> Arc<dyn PrincipalStore> {
    match env::var("DATABASE_URL") {
        Ok(database_url) if !database_url.trim().is_empty() => {
            Arc::new(PostgresPrincipalStore::new(database_url))
        }
        _ => {
            if parse_env_bool("AUTH_ALLOW_IN_MEMORY_PRINCIPAL_STORE", false) {
                warn!("using in-memory principal store due to AUTH_ALLOW_IN_MEMORY_PRINCIPAL_STORE=true");
                Arc::new(InMemoryPrincipalStore::from_env())
            } else {
                warn!("DATABASE_URL missing; principal store will fail-close");
                Arc::new(UnavailablePrincipalStore::new(
                    "principal_store_unconfigured",
                ))
            }
        }
    }
}

/// UNIX時刻(秒)を返す。
/// @param なし
/// @returns 現在UNIX時刻(秒)
/// @throws なし
pub fn unix_timestamp_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn parse_env_u64(name: &str, default: u64) -> u64 {
    env::var(name)
        .ok()
        .and_then(|value| value.parse::<u64>().ok())
        .unwrap_or(default)
}

fn parse_env_bool(name: &str, default: bool) -> bool {
    match env::var(name) {
        Ok(value) => {
            let normalized = value.trim().to_ascii_lowercase();
            matches!(normalized.as_str(), "1" | "true" | "yes" | "on")
        }
        Err(_) => default,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::OnceLock;

    fn env_lock() -> &'static tokio::sync::Mutex<()> {
        static ENV_LOCK: OnceLock<tokio::sync::Mutex<()>> = OnceLock::new();
        ENV_LOCK.get_or_init(|| tokio::sync::Mutex::new(()))
    }

    struct ScopedEnv {
        backups: Vec<(String, Option<String>)>,
    }

    impl ScopedEnv {
        fn new() -> Self {
            Self {
                backups: Vec::new(),
            }
        }

        fn set(&mut self, name: &str, value: &str) {
            if !self.backups.iter().any(|(saved, _)| saved == name) {
                self.backups.push((name.to_owned(), env::var(name).ok()));
            }
            env::set_var(name, value);
        }

        fn remove(&mut self, name: &str) {
            if !self.backups.iter().any(|(saved, _)| saved == name) {
                self.backups.push((name.to_owned(), env::var(name).ok()));
            }
            env::remove_var(name);
        }
    }

    impl Drop for ScopedEnv {
        fn drop(&mut self) {
            for (name, value) in self.backups.iter().rev() {
                if let Some(value) = value {
                    env::set_var(name, value);
                } else {
                    env::remove_var(name);
                }
            }
        }
    }

    struct StaticTokenVerifier;

    #[async_trait]
    impl TokenVerifier for StaticTokenVerifier {
        async fn verify(&self, token: &str) -> Result<VerifiedToken, TokenVerifyError> {
            let Some((uid, exp)) = token.split_once(':') else {
                return Err(TokenVerifyError::Invalid("token_format_invalid"));
            };

            let expires_at_epoch = exp
                .parse::<u64>()
                .map_err(|_| TokenVerifyError::Invalid("token_exp_invalid"))?;

            if expires_at_epoch <= unix_timestamp_seconds() {
                return Err(TokenVerifyError::Expired);
            }

            Ok(VerifiedToken {
                uid: uid.to_owned(),
                expires_at_epoch,
            })
        }
    }

    #[tokio::test]
    async fn auth_service_resolves_principal() {
        let metrics = Arc::new(AuthMetrics::default());
        let verifier: Arc<dyn TokenVerifier> = Arc::new(StaticTokenVerifier);
        let store = InMemoryPrincipalStore::default();
        store
            .insert(FIREBASE_PROVIDER, "u-1", PrincipalId(42))
            .await;

        let resolver: Arc<dyn PrincipalResolver> = Arc::new(CachingPrincipalResolver::new(
            FIREBASE_PROVIDER.to_owned(),
            Arc::new(InMemoryPrincipalCache::default()),
            Arc::new(store),
            Duration::from_secs(30),
            Arc::clone(&metrics),
        ));

        let service = AuthService::new(verifier, resolver, metrics);
        let token = format!("u-1:{}", unix_timestamp_seconds() + 60);

        let authenticated = service.authenticate_token(&token).await.unwrap();
        assert_eq!(authenticated.principal_id.0, 42);
        assert_eq!(authenticated.firebase_uid, "u-1");
    }

    #[test]
    fn bearer_header_parser_requires_bearer_scheme() {
        let mut headers = HeaderMap::new();
        headers.insert(AUTHORIZATION, "Basic x".parse().unwrap());

        let error = bearer_token_from_headers(&headers).unwrap_err();
        assert_eq!(error.kind, AuthErrorKind::InvalidToken);
    }

    #[test]
    fn request_id_prefers_header_value() {
        let mut headers = HeaderMap::new();
        headers.insert("x-request-id", "req-1".parse().unwrap());

        assert_eq!(request_id_from_headers(&headers), "req-1");
    }

    #[test]
    fn auth_error_decision_maps_unavailable_separately() {
        assert_eq!(AuthError::invalid_token("bad").decision(), "deny");
        assert_eq!(
            AuthError::dependency_unavailable("downstream_down").decision(),
            "unavailable"
        );
    }

    #[tokio::test]
    async fn jwks_cache_respects_missing_kid_refresh_backoff() {
        let client = Client::builder()
            .timeout(Duration::from_millis(50))
            .build()
            .unwrap();
        let cache = JwksCache::new(
            client,
            "http://127.0.0.1:9/jwks".to_owned(),
            Duration::from_secs(300),
        );

        {
            let mut state = cache.state.write().await;
            state.fetched_at = Some(Instant::now());
            state
                .missing_kid_refresh_at
                .insert("unknown".to_owned(), Instant::now());
            state.keys.insert(
                "known".to_owned(),
                JwkRsaKey {
                    kid: "known".to_owned(),
                    kty: "RSA".to_owned(),
                    n: "AQAB".to_owned(),
                    e: "AQAB".to_owned(),
                },
            );
        }

        let result = cache.key_for("unknown").await;
        assert!(matches!(
            result,
            Err(TokenVerifyError::Invalid("jwks_kid_not_found"))
        ));
    }

    #[tokio::test]
    async fn jwks_cache_backoff_is_tracked_per_kid() {
        let client = Client::builder()
            .timeout(Duration::from_millis(50))
            .build()
            .unwrap();
        let cache = JwksCache::new(
            client,
            "http://127.0.0.1:9/jwks".to_owned(),
            Duration::from_secs(300),
        );

        {
            let mut state = cache.state.write().await;
            state.fetched_at = Some(Instant::now());
            state
                .missing_kid_refresh_at
                .insert("unknown-a".to_owned(), Instant::now());
            state.keys.insert(
                "known".to_owned(),
                JwkRsaKey {
                    kid: "known".to_owned(),
                    kty: "RSA".to_owned(),
                    n: "AQAB".to_owned(),
                    e: "AQAB".to_owned(),
                },
            );
        }

        let result_a = cache.key_for("unknown-a").await;
        assert!(matches!(
            result_a,
            Err(TokenVerifyError::Invalid("jwks_kid_not_found"))
        ));

        let result_b = cache.key_for("unknown-b").await;
        assert!(matches!(
            result_b,
            Err(TokenVerifyError::DependencyUnavailable(_))
        ));
    }

    #[tokio::test]
    async fn jwks_cache_global_backoff_limits_distinct_kid_refresh_bursts() {
        let client = Client::builder()
            .timeout(Duration::from_millis(50))
            .build()
            .unwrap();
        let cache = JwksCache::new(
            client,
            "http://127.0.0.1:9/jwks".to_owned(),
            Duration::from_secs(300),
        );

        {
            let mut state = cache.state.write().await;
            state.fetched_at = Some(Instant::now());
            state.missing_kid_refresh_at.clear();
            state.keys.insert(
                "known".to_owned(),
                JwkRsaKey {
                    kid: "known".to_owned(),
                    kty: "RSA".to_owned(),
                    n: "AQAB".to_owned(),
                    e: "AQAB".to_owned(),
                },
            );
        }

        let first = cache.key_for("unknown-a").await;
        assert!(matches!(
            first,
            Err(TokenVerifyError::DependencyUnavailable(_))
        ));

        let second = cache.key_for("unknown-b").await;
        assert!(matches!(
            second,
            Err(TokenVerifyError::DependencyUnavailable(_))
        ));
    }

    #[tokio::test]
    async fn jwks_cache_triggers_refresh_on_fresh_kid_miss_when_backoff_allows() {
        let client = Client::builder()
            .timeout(Duration::from_millis(50))
            .build()
            .unwrap();
        let cache = JwksCache::new(
            client,
            "http://127.0.0.1:9/jwks".to_owned(),
            Duration::from_secs(300),
        );

        {
            let mut state = cache.state.write().await;
            state.fetched_at = Some(Instant::now());
            state.missing_kid_refresh_at.clear();
            state.keys.insert(
                "known".to_owned(),
                JwkRsaKey {
                    kid: "known".to_owned(),
                    kty: "RSA".to_owned(),
                    n: "AQAB".to_owned(),
                    e: "AQAB".to_owned(),
                },
            );
        }

        let result = cache.key_for("unknown").await;
        assert!(matches!(
            result,
            Err(TokenVerifyError::DependencyUnavailable(_))
        ));
    }

    #[tokio::test]
    async fn jwks_cache_keeps_unavailable_class_during_backoff() {
        let client = Client::builder()
            .timeout(Duration::from_millis(50))
            .build()
            .unwrap();
        let cache = JwksCache::new(
            client,
            "http://127.0.0.1:9/jwks".to_owned(),
            Duration::from_secs(300),
        );

        {
            let mut state = cache.state.write().await;
            state.fetched_at = Some(Instant::now());
            state.missing_kid_refresh_at.clear();
            state.keys.insert(
                "known".to_owned(),
                JwkRsaKey {
                    kid: "known".to_owned(),
                    kty: "RSA".to_owned(),
                    n: "AQAB".to_owned(),
                    e: "AQAB".to_owned(),
                },
            );
        }

        let first = cache.key_for("unknown").await;
        assert!(matches!(
            first,
            Err(TokenVerifyError::DependencyUnavailable(_))
        ));

        let second = cache.key_for("unknown").await;
        assert!(matches!(
            second,
            Err(TokenVerifyError::DependencyUnavailable(_))
        ));
    }

    #[tokio::test]
    async fn jwks_cache_stale_path_fails_fast_after_recent_unavailable() {
        let client = Client::builder()
            .timeout(Duration::from_millis(50))
            .build()
            .unwrap();
        let cache = JwksCache::new(
            client,
            "http://127.0.0.1:9/jwks".to_owned(),
            Duration::from_millis(10),
        );

        {
            let mut state = cache.state.write().await;
            state.fetched_at = Some(Instant::now() - Duration::from_secs(1));
            state.last_refresh_unavailable_at = Some(Instant::now());
        }

        let result = cache.key_for("unknown").await;
        assert!(matches!(
            result,
            Err(TokenVerifyError::DependencyUnavailable(_))
        ));
    }

    #[tokio::test]
    async fn in_memory_principal_cache_removes_expired_entries() {
        let cache = InMemoryPrincipalCache::default();
        cache
            .set(
                FIREBASE_PROVIDER,
                "u-expired",
                PrincipalId(99),
                Duration::from_millis(5),
            )
            .await
            .unwrap();

        tokio::time::sleep(Duration::from_millis(10)).await;

        let result = cache.get(FIREBASE_PROVIDER, "u-expired").await.unwrap();
        assert_eq!(result, None);

        let entries = cache.entries.read().await;
        assert!(entries.is_empty());
    }

    #[tokio::test]
    async fn runtime_principal_store_fail_closes_without_database_url() {
        let _lock = env_lock().lock().await;
        let mut scoped = ScopedEnv::new();
        scoped.remove("DATABASE_URL");
        scoped.remove("AUTH_ALLOW_IN_MEMORY_PRINCIPAL_STORE");
        scoped.remove("AUTH_UID_PRINCIPAL_SEEDS");

        let store = build_runtime_principal_store();
        let error = store
            .find_principal_id(FIREBASE_PROVIDER, "u-1")
            .await
            .unwrap_err();

        assert_eq!(error, "principal_store_unconfigured");
    }

    #[tokio::test]
    async fn runtime_principal_store_uses_seeded_mappings_when_opted_in() {
        let _lock = env_lock().lock().await;
        let mut scoped = ScopedEnv::new();
        scoped.remove("DATABASE_URL");
        scoped.set("AUTH_ALLOW_IN_MEMORY_PRINCIPAL_STORE", "true");
        scoped.set("AUTH_UID_PRINCIPAL_SEEDS", "u-1=7001");

        let store = build_runtime_principal_store();
        let resolved = store
            .find_principal_id(FIREBASE_PROVIDER, "u-1")
            .await
            .unwrap();

        assert_eq!(resolved, Some(PrincipalId(7001)));
    }
}
