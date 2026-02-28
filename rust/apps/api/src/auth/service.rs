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
    /// 検証済みトークンからprincipal_idを解決する。
    /// @param verified 検証済みトークン
    /// @returns principal_id
    /// @throws PrincipalResolveError 未紐付け/入力不正/競合/依存障害時
    async fn resolve_principal_id(
        &self,
        verified: &VerifiedToken,
    ) -> Result<PrincipalId, PrincipalResolveError>;
}

/// トークン検証済み情報を保持する。
#[derive(Debug, Clone)]
pub struct VerifiedToken {
    pub uid: String,
    pub email: Option<String>,
    pub email_verified: bool,
    pub display_name: Option<String>,
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
    InvalidInput(String),
    Conflict(String),
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

        if !verified.email_verified {
            warn!(
                decision = "deny",
                firebase_uid = %verified.uid,
                email_verified = verified.email_verified,
                reason = "firebase_email_not_verified",
                "auth rejected by email verification policy"
            );
            return Err(AuthError::email_not_verified("firebase_email_not_verified"));
        }

        let principal_id = self
            .resolver
            .resolve_principal_id(&verified)
            .await
            .map_err(|error| match error {
                PrincipalResolveError::InvalidInput(reason) => AuthError::invalid_token(reason),
                PrincipalResolveError::Conflict(reason) => AuthError::principal_not_mapped(reason),
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
