use std::{
    collections::HashMap,
    time::{Duration, Instant},
};

use serde::Deserialize;
use tokio::sync::RwLock;

/// 認可判定入力を表現する。
#[derive(Debug, Clone)]
pub struct AuthzCheckInput {
    pub principal_id: PrincipalId,
    pub resource: AuthzResource,
    pub action: AuthzAction,
}

/// 認可対象リソースを表現する。
#[derive(Debug, Clone)]
pub enum AuthzResource {
    Session,
    Guild { guild_id: i64 },
    GuildChannel { guild_id: i64, channel_id: i64 },
    Channel { channel_id: i64 },
    RestPath { path: String },
}

/// 認可アクションを表現する。
#[derive(Debug, Clone, Copy)]
pub enum AuthzAction {
    Connect,
    View,
    Post,
    Manage,
}

/// 認可判定責務の境界を表現する。
#[async_trait]
pub trait Authorizer: Send + Sync {
    /// 認可判定を実行する。
    /// @param input 判定入力
    /// @returns 許可時は `Ok(())`
    /// @throws AuthzError 拒否または依存障害時
    async fn check(&self, input: &AuthzCheckInput) -> Result<(), AuthzError>;
}

/// 暫定の allow-all 認可実装を表現する。
#[derive(Debug)]
pub struct NoopAllowAllAuthorizer {
    allow_all_until: String,
    mode: NoopAuthorizerMode,
}

/// noop認可の応答モードを表現する。
#[derive(Debug, Clone, Copy)]
pub enum NoopAuthorizerMode {
    Allow,
    Deny,
    Unavailable,
}

impl NoopAllowAllAuthorizer {
    /// allow-all 認可実装を生成する。
    /// @param allow_all_until 例外期限（YYYY-MM-DD）
    /// @param mode 認可応答モード
    /// @returns 認可実装
    /// @throws なし
    pub fn new(allow_all_until: String, mode: NoopAuthorizerMode) -> Self {
        Self {
            allow_all_until,
            mode,
        }
    }
}

#[async_trait]
impl Authorizer for NoopAllowAllAuthorizer {
    /// 暫定の認可判定を実行する。
    /// @param _input 判定入力
    /// @returns 常に許可
    /// @throws なし
    async fn check(&self, input: &AuthzCheckInput) -> Result<(), AuthzError> {
        let action_label = authz_action_label(input.action);
        let resource_label = authz_resource_label(&input.resource);
        // TODO(LIN-629): Replace noop allow-all with SpiceDB-backed authorization checks.
        match self.mode {
            NoopAuthorizerMode::Allow => {
                tracing::debug!(
                    principal_id = input.principal_id.0,
                    action = action_label,
                    resource = %resource_label,
                    allow_all_until = %self.allow_all_until,
                    "noop allow-all authorizer accepted request"
                );
                Ok(())
            }
            NoopAuthorizerMode::Deny => {
                tracing::debug!(
                    principal_id = input.principal_id.0,
                    action = action_label,
                    resource = %resource_label,
                    allow_all_until = %self.allow_all_until,
                    "noop authorizer deny mode rejected request"
                );
                Err(AuthzError::denied("noop_deny_mode"))
            }
            NoopAuthorizerMode::Unavailable => {
                tracing::debug!(
                    principal_id = input.principal_id.0,
                    action = action_label,
                    resource = %resource_label,
                    allow_all_until = %self.allow_all_until,
                    "noop authorizer unavailable mode rejected request"
                );
                Err(AuthzError::unavailable("noop_unavailable_mode"))
            }
        }
    }
}

/// 設定不備時にfail-closeする認可実装を表現する。
#[derive(Debug)]
pub struct FailClosedAuthorizer {
    reason: String,
}

impl FailClosedAuthorizer {
    /// fail-close 認可実装を生成する。
    /// @param reason 拒否理由
    /// @returns fail-close認可実装
    /// @throws なし
    pub fn new(reason: impl Into<String>) -> Self {
        Self {
            reason: reason.into(),
        }
    }
}

#[async_trait]
impl Authorizer for FailClosedAuthorizer {
    /// 常に依存障害としてfail-closeする。
    /// @param _input 判定入力
    /// @returns 常に依存障害
    /// @throws AuthzError 常に unavailable
    async fn check(&self, _input: &AuthzCheckInput) -> Result<(), AuthzError> {
        Err(AuthzError::unavailable(self.reason.clone()))
    }
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct SpiceDbObjectReference {
    object_type: String,
    object_id: String,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct SpiceDbSubjectReference {
    object: SpiceDbObjectReference,
    #[serde(skip_serializing_if = "Option::is_none")]
    optional_relation: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct SpiceDbConsistency {
    fully_consistent: bool,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct SpiceDbCheckPermissionRequest {
    consistency: SpiceDbConsistency,
    resource: SpiceDbObjectReference,
    permission: String,
    subject: SpiceDbSubjectReference,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SpiceDbCheckPermissionResponse {
    permissionship: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum CachedDecision {
    Allow,
    Deny,
}

#[derive(Debug, Clone)]
struct CachedAuthzDecision {
    decision: CachedDecision,
    expires_at: Instant,
}

/// SpiceDB HTTP API 経由で認可判定を行う実装を表現する。
pub struct SpiceDbHttpAuthorizer {
    check_endpoint: String,
    preshared_key: String,
    request_timeout: Duration,
    check_max_retries: u32,
    check_retry_backoff: Duration,
    cache_allow_ttl: Duration,
    cache_deny_ttl: Duration,
    policy_version: String,
    client: reqwest::Client,
    cache: RwLock<HashMap<String, CachedAuthzDecision>>,
}

impl SpiceDbHttpAuthorizer {
    /// SpiceDB認可実装を生成する。
    /// @param config SpiceDB実行時設定
    /// @returns SpiceDB認可実装
    /// @throws String 設定不正やHTTPクライアント初期化失敗時
    pub fn new(config: &SpiceDbRuntimeConfig) -> Result<Self, String> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_millis(config.request_timeout_ms))
            .build()
            .map_err(|error| format!("spicedb_http_client_build_failed:{error}"))?;

        let normalized_check_endpoint = config.check_endpoint.trim_end_matches('/').to_owned();
        if reqwest::Url::parse(&normalized_check_endpoint).is_err() {
            return Err("SPICEDB_CHECK_ENDPOINT must be a valid URL".to_owned());
        }

        Ok(Self {
            check_endpoint: normalized_check_endpoint,
            preshared_key: config.preshared_key.clone(),
            request_timeout: Duration::from_millis(config.request_timeout_ms),
            check_max_retries: config.check_max_retries,
            check_retry_backoff: Duration::from_millis(config.check_retry_backoff_ms),
            cache_allow_ttl: Duration::from_millis(config.cache_allow_ttl_ms),
            cache_deny_ttl: Duration::from_millis(config.cache_deny_ttl_ms),
            policy_version: config.policy_version.clone(),
            client,
            cache: RwLock::new(HashMap::new()),
        })
    }

    fn build_cache_key(&self, input: &AuthzCheckInput) -> String {
        format!(
            "{}|{}|{}|{}",
            input.principal_id.0,
            authz_resource_cache_key(&input.resource),
            authz_action_label(input.action),
            self.policy_version,
        )
    }

    async fn read_cached_decision(&self, cache_key: &str) -> Option<CachedDecision> {
        let now = Instant::now();
        {
            let cache = self.cache.read().await;
            if let Some(cached) = cache.get(cache_key) {
                if cached.expires_at > now {
                    return Some(cached.decision);
                }
            }
        }

        let mut cache = self.cache.write().await;
        if let Some(cached) = cache.get(cache_key) {
            if cached.expires_at <= now {
                cache.remove(cache_key);
            }
        }

        None
    }

    async fn write_cached_decision(&self, cache_key: String, decision: CachedDecision) {
        let ttl = match decision {
            CachedDecision::Allow => self.cache_allow_ttl,
            CachedDecision::Deny => self.cache_deny_ttl,
        };

        let expires_at = Instant::now() + ttl;
        let mut cache = self.cache.write().await;
        cache.insert(
            cache_key,
            CachedAuthzDecision {
                decision,
                expires_at,
            },
        );
    }

    fn build_spicedb_check_request(
        &self,
        input: &AuthzCheckInput,
    ) -> Result<SpiceDbCheckPermissionRequest, AuthzError> {
        let subject = SpiceDbSubjectReference {
            object: SpiceDbObjectReference {
                object_type: "user".to_owned(),
                object_id: input.principal_id.0.to_string(),
            },
            optional_relation: None,
        };

        let (resource, permission) = match (&input.resource, input.action) {
            (AuthzResource::Session, AuthzAction::Connect) => (
                SpiceDbObjectReference {
                    object_type: "session".to_owned(),
                    object_id: "global".to_owned(),
                },
                "can_connect".to_owned(),
            ),
            (AuthzResource::Session, _) => {
                return Err(AuthzError::denied("session_action_not_supported"));
            }
            (AuthzResource::Guild { guild_id }, AuthzAction::View) => (
                SpiceDbObjectReference {
                    object_type: "guild".to_owned(),
                    object_id: guild_id.to_string(),
                },
                "can_view".to_owned(),
            ),
            (AuthzResource::Guild { guild_id }, AuthzAction::Manage) => (
                SpiceDbObjectReference {
                    object_type: "guild".to_owned(),
                    object_id: guild_id.to_string(),
                },
                "can_manage".to_owned(),
            ),
            (AuthzResource::Guild { .. }, _) => {
                return Err(AuthzError::denied("guild_action_not_supported"));
            }
            (
                AuthzResource::GuildChannel {
                    guild_id: _,
                    channel_id,
                },
                AuthzAction::View,
            ) => (
                SpiceDbObjectReference {
                    object_type: "channel".to_owned(),
                    object_id: channel_id.to_string(),
                },
                "can_view".to_owned(),
            ),
            (
                AuthzResource::GuildChannel {
                    guild_id: _,
                    channel_id,
                },
                AuthzAction::Post,
            ) => (
                SpiceDbObjectReference {
                    object_type: "channel".to_owned(),
                    object_id: channel_id.to_string(),
                },
                "can_post".to_owned(),
            ),
            (
                AuthzResource::GuildChannel {
                    guild_id: _,
                    channel_id,
                },
                AuthzAction::Manage,
            ) => (
                SpiceDbObjectReference {
                    object_type: "channel".to_owned(),
                    object_id: channel_id.to_string(),
                },
                "can_manage".to_owned(),
            ),
            (AuthzResource::GuildChannel { .. }, _) => {
                return Err(AuthzError::denied("guild_channel_action_not_supported"));
            }
            (AuthzResource::Channel { channel_id }, AuthzAction::View) => (
                SpiceDbObjectReference {
                    object_type: "channel".to_owned(),
                    object_id: channel_id.to_string(),
                },
                "can_view".to_owned(),
            ),
            (AuthzResource::Channel { channel_id }, AuthzAction::Post) => (
                SpiceDbObjectReference {
                    object_type: "channel".to_owned(),
                    object_id: channel_id.to_string(),
                },
                "can_post".to_owned(),
            ),
            (AuthzResource::Channel { channel_id }, AuthzAction::Manage) => (
                SpiceDbObjectReference {
                    object_type: "channel".to_owned(),
                    object_id: channel_id.to_string(),
                },
                "can_manage".to_owned(),
            ),
            (AuthzResource::Channel { .. }, _) => {
                return Err(AuthzError::denied("channel_action_not_supported"));
            }
            (AuthzResource::RestPath { path }, AuthzAction::View) => (
                SpiceDbObjectReference {
                    object_type: "api_path".to_owned(),
                    object_id: path.clone(),
                },
                "can_view".to_owned(),
            ),
            (AuthzResource::RestPath { .. }, _) => {
                return Err(AuthzError::denied("rest_path_action_not_supported"));
            }
        };

        Ok(SpiceDbCheckPermissionRequest {
            consistency: SpiceDbConsistency {
                fully_consistent: true,
            },
            resource,
            permission,
            subject,
        })
    }

    async fn execute_check_with_retry(
        &self,
        payload: &SpiceDbCheckPermissionRequest,
    ) -> Result<CachedDecision, AuthzError> {
        let url = format!("{}/v1/permissions/check", self.check_endpoint);
        let authorization = format!("Bearer {}", self.preshared_key);

        let mut attempt = 0_u32;
        loop {
            let started_at = Instant::now();
            let response = self
                .client
                .post(url.clone())
                .header("Authorization", authorization.clone())
                .json(payload)
                .send()
                .await;

            match response {
                Ok(response) => {
                    if !response.status().is_success() {
                        let reason = format!(
                            "spicedb_check_http_status:{}",
                            response.status().as_u16()
                        );
                        if attempt >= self.check_max_retries {
                            return Err(AuthzError::unavailable(reason));
                        }
                        self.sleep_retry_backoff(attempt).await;
                        attempt = attempt.saturating_add(1);
                        continue;
                    }

                    let body = response
                        .json::<SpiceDbCheckPermissionResponse>()
                        .await
                        .map_err(|error| {
                            AuthzError::unavailable(format!(
                                "spicedb_check_response_decode_failed:{error}"
                            ))
                        })?;

                    let elapsed_ms = started_at.elapsed().as_millis() as u64;
                    tracing::debug!(
                        permissionship = %body.permissionship,
                        elapsed_ms,
                        timeout_ms = self.request_timeout.as_millis() as u64,
                        "spicedb check permission completed"
                    );

                    return match body.permissionship.as_str() {
                        "PERMISSIONSHIP_HAS_PERMISSION" => Ok(CachedDecision::Allow),
                        "PERMISSIONSHIP_NO_PERMISSION"
                        | "PERMISSIONSHIP_UNSPECIFIED"
                        | "PERMISSIONSHIP_CONDITIONAL_PERMISSION" => Ok(CachedDecision::Deny),
                        _ => Err(AuthzError::unavailable(format!(
                            "spicedb_check_permissionship_unknown:{}",
                            body.permissionship
                        ))),
                    };
                }
                Err(error) => {
                    let reason = if error.is_timeout() {
                        format!("spicedb_check_timeout:{}", self.request_timeout.as_millis())
                    } else {
                        format!("spicedb_check_transport_failed:{error}")
                    };

                    if attempt >= self.check_max_retries {
                        return Err(AuthzError::unavailable(reason));
                    }

                    self.sleep_retry_backoff(attempt).await;
                    attempt = attempt.saturating_add(1);
                }
            }
        }
    }

    async fn sleep_retry_backoff(&self, attempt: u32) {
        let factor = 1u32.checked_shl(attempt.min(16)).unwrap_or(u32::MAX);
        let backoff = self.check_retry_backoff.saturating_mul(factor);
        tokio::time::sleep(backoff).await;
    }
}

#[async_trait]
impl Authorizer for SpiceDbHttpAuthorizer {
    /// SpiceDBへ認可判定を問い合わせる。
    /// @param input 判定入力
    /// @returns 許可時は `Ok(())`
    /// @throws AuthzError 判定拒否または依存障害時
    async fn check(&self, input: &AuthzCheckInput) -> Result<(), AuthzError> {
        let cache_key = self.build_cache_key(input);

        if let Some(cached_decision) = self.read_cached_decision(&cache_key).await {
            tracing::debug!(
                principal_id = input.principal_id.0,
                resource = %authz_resource_label(&input.resource),
                action = authz_action_label(input.action),
                decision_source = "cache",
                "spicedb authorizer cache hit"
            );
            return match cached_decision {
                CachedDecision::Allow => Ok(()),
                CachedDecision::Deny => Err(AuthzError::denied("spicedb_no_permission")),
            };
        }

        let payload = self.build_spicedb_check_request(input)?;
        let decision = self.execute_check_with_retry(&payload).await?;

        self.write_cached_decision(cache_key, decision).await;
        match decision {
            CachedDecision::Allow => Ok(()),
            CachedDecision::Deny => Err(AuthzError::denied("spicedb_no_permission")),
        }
    }
}

fn authz_action_label(action: AuthzAction) -> &'static str {
    match action {
        AuthzAction::Connect => "connect",
        AuthzAction::View => "view",
        AuthzAction::Post => "post",
        AuthzAction::Manage => "manage",
    }
}

fn authz_resource_label(resource: &AuthzResource) -> String {
    match resource {
        AuthzResource::Session => "session".to_owned(),
        AuthzResource::Guild { guild_id } => format!("guild:{guild_id}"),
        AuthzResource::GuildChannel {
            guild_id,
            channel_id,
        } => format!("guild:{guild_id}/channel:{channel_id}"),
        AuthzResource::Channel { channel_id } => format!("channel:{channel_id}"),
        AuthzResource::RestPath { path } => path.clone(),
    }
}

fn authz_resource_cache_key(resource: &AuthzResource) -> String {
    match resource {
        AuthzResource::Session => "session:global".to_owned(),
        AuthzResource::Guild { guild_id } => format!("guild:{guild_id}"),
        AuthzResource::GuildChannel {
            guild_id,
            channel_id,
        } => format!("guild:{guild_id}/channel:{channel_id}"),
        AuthzResource::Channel { channel_id } => format!("channel:{channel_id}"),
        AuthzResource::RestPath { path } => format!("api_path:{path}"),
    }
}
