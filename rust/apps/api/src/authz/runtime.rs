const DEFAULT_AUTHZ_PROVIDER: &str = "noop";
const DEFAULT_ALLOW_ALL_UNTIL: &str = "2026-06-30";

/// 実行時向けの認可実装を生成する。
/// @param なし
/// @returns 認可実装
/// @throws なし
pub fn build_runtime_authorizer() -> Arc<dyn Authorizer> {
    let supported_actions = [
        AuthzAction::Connect,
        AuthzAction::View,
        AuthzAction::Post,
        AuthzAction::Manage,
    ];
    let provider = env::var("AUTHZ_PROVIDER")
        .unwrap_or_else(|_| DEFAULT_AUTHZ_PROVIDER.to_owned())
        .trim()
        .to_ascii_lowercase();

    let allow_all_until = env::var("AUTHZ_ALLOW_ALL_UNTIL")
        .unwrap_or_else(|_| DEFAULT_ALLOW_ALL_UNTIL.to_owned())
        .trim()
        .to_owned();

    match provider.as_str() {
        "noop" => {
            warn!(
                provider = "noop",
                allow_all_until = %allow_all_until,
                supported_action_count = supported_actions.len(),
                "AuthZ noop allow-all is active as temporary exception"
            );
            Arc::new(NoopAllowAllAuthorizer::new(
                allow_all_until,
                NoopAuthorizerMode::Allow,
            ))
        }
        "noop_deny" => {
            warn!(
                provider = "noop_deny",
                allow_all_until = %allow_all_until,
                supported_action_count = supported_actions.len(),
                "AuthZ noop deny mode is active for contract testing"
            );
            Arc::new(NoopAllowAllAuthorizer::new(
                allow_all_until,
                NoopAuthorizerMode::Deny,
            ))
        }
        "noop_unavailable" => {
            warn!(
                provider = "noop_unavailable",
                allow_all_until = %allow_all_until,
                supported_action_count = supported_actions.len(),
                "AuthZ noop unavailable mode is active for contract testing"
            );
            Arc::new(NoopAllowAllAuthorizer::new(
                allow_all_until,
                NoopAuthorizerMode::Unavailable,
            ))
        }
        "spicedb" => {
            warn!(
                provider = "spicedb",
                fallback = "noop",
                allow_all_until = %allow_all_until,
                supported_action_count = supported_actions.len(),
                "AUTHZ_PROVIDER=spicedb is not implemented yet; fallback to noop allow-all"
            );
            Arc::new(NoopAllowAllAuthorizer::new(
                allow_all_until,
                NoopAuthorizerMode::Allow,
            ))
        }
        _ => {
            warn!(
                provider = %provider,
                fallback = "noop",
                allow_all_until = %allow_all_until,
                supported_action_count = supported_actions.len(),
                "unknown AUTHZ_PROVIDER; fallback to noop allow-all"
            );
            Arc::new(NoopAllowAllAuthorizer::new(
                allow_all_until,
                NoopAuthorizerMode::Allow,
            ))
        }
    }
}
