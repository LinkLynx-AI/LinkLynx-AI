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
        let action_label = match input.action {
            AuthzAction::Connect => "connect",
            AuthzAction::View => "view",
            AuthzAction::Post => "post",
            AuthzAction::Manage => "manage",
        };
        let resource_label = match &input.resource {
            AuthzResource::Session => "session".to_owned(),
            AuthzResource::RestPath { path } => path.clone(),
        };
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
