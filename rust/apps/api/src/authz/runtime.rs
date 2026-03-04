const DEFAULT_AUTHZ_PROVIDER: &str = "noop";
const DEFAULT_ALLOW_ALL_UNTIL: &str = "2026-06-30";
const DEFAULT_SPICEDB_ENDPOINT: &str = "http://localhost:50051";
const DEFAULT_SPICEDB_CHECK_ENDPOINT: &str = "http://localhost:8443";
const DEFAULT_SPICEDB_REQUEST_TIMEOUT_MS: u64 = 1000;
const DEFAULT_SPICEDB_CHECK_MAX_RETRIES: u32 = 1;
const DEFAULT_SPICEDB_CHECK_RETRY_BACKOFF_MS: u64 = 100;
const DEFAULT_AUTHZ_CACHE_ALLOW_TTL_MS: u64 = 5000;
const DEFAULT_AUTHZ_CACHE_DENY_TTL_MS: u64 = 1000;
const DEFAULT_SPICEDB_POLICY_VERSION: &str = "lin862-v1";
const DEFAULT_SPICEDB_SCHEMA_PATH: &str =
    "database/contracts/lin862_spicedb_namespace_relation_permission_contract.md";

/// SpiceDB接続の実行時設定を表現する。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SpiceDbRuntimeConfig {
    pub endpoint: String,
    pub check_endpoint: String,
    pub preshared_key: String,
    pub request_timeout_ms: u64,
    pub check_max_retries: u32,
    pub check_retry_backoff_ms: u64,
    pub cache_allow_ttl_ms: u64,
    pub cache_deny_ttl_ms: u64,
    pub policy_version: String,
    pub schema_path: String,
}

/// 実行時環境変数からSpiceDB接続設定を構築する。
/// @param なし
/// @returns 構築済みSpiceDB設定
/// @throws String 必須値欠落または不正値時
pub fn build_spicedb_runtime_config_from_env() -> Result<SpiceDbRuntimeConfig, String> {
    let endpoint = parse_optional_non_empty_env("SPICEDB_ENDPOINT", DEFAULT_SPICEDB_ENDPOINT)?;
    let check_endpoint =
        parse_optional_non_empty_env("SPICEDB_CHECK_ENDPOINT", DEFAULT_SPICEDB_CHECK_ENDPOINT)?;
    let preshared_key = parse_required_non_empty_env("SPICEDB_PRESHARED_KEY")?;
    let request_timeout_ms = parse_optional_u64_env(
        "SPICEDB_REQUEST_TIMEOUT_MS",
        DEFAULT_SPICEDB_REQUEST_TIMEOUT_MS,
    )?;
    let check_max_retries = parse_optional_u32_env(
        "SPICEDB_CHECK_MAX_RETRIES",
        DEFAULT_SPICEDB_CHECK_MAX_RETRIES,
    )?;
    let check_retry_backoff_ms = parse_optional_u64_env(
        "SPICEDB_CHECK_RETRY_BACKOFF_MS",
        DEFAULT_SPICEDB_CHECK_RETRY_BACKOFF_MS,
    )?;
    let cache_allow_ttl_ms =
        parse_optional_u64_env("AUTHZ_CACHE_ALLOW_TTL_MS", DEFAULT_AUTHZ_CACHE_ALLOW_TTL_MS)?;
    let cache_deny_ttl_ms =
        parse_optional_u64_env("AUTHZ_CACHE_DENY_TTL_MS", DEFAULT_AUTHZ_CACHE_DENY_TTL_MS)?;
    let policy_version =
        parse_optional_non_empty_env("SPICEDB_POLICY_VERSION", DEFAULT_SPICEDB_POLICY_VERSION)?;
    let schema_path = parse_optional_non_empty_env("SPICEDB_SCHEMA_PATH", DEFAULT_SPICEDB_SCHEMA_PATH)?;

    if reqwest::Url::parse(&endpoint).is_err() {
        return Err("SPICEDB_ENDPOINT must be a valid URL".to_owned());
    }
    if reqwest::Url::parse(&check_endpoint).is_err() {
        return Err("SPICEDB_CHECK_ENDPOINT must be a valid URL".to_owned());
    }

    Ok(SpiceDbRuntimeConfig {
        endpoint,
        check_endpoint,
        preshared_key,
        request_timeout_ms,
        check_max_retries,
        check_retry_backoff_ms,
        cache_allow_ttl_ms,
        cache_deny_ttl_ms,
        policy_version,
        schema_path,
    })
}

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
            match build_spicedb_runtime_config_from_env() {
                Ok(config) => {
                    match build_spicedb_tuple_sync_runtime_config_from_env() {
                        Ok(tuple_sync_config) => {
                            warn!(
                                provider = "spicedb",
                                outbox_claim_limit = tuple_sync_config.outbox_claim_limit,
                                outbox_lease_seconds = tuple_sync_config.outbox_lease_seconds,
                                outbox_retry_seconds = tuple_sync_config.outbox_retry_seconds,
                                "AUTHZ_PROVIDER=spicedb tuple sync runtime config is ready"
                            );
                        }
                        Err(reason) => {
                            warn!(
                                provider = "spicedb",
                                reason = %reason,
                                "AUTHZ_PROVIDER=spicedb tuple sync runtime config is invalid"
                            );
                        }
                    }

                    warn!(
                        provider = "spicedb",
                        endpoint = %config.endpoint,
                        check_endpoint = %config.check_endpoint,
                        request_timeout_ms = config.request_timeout_ms,
                        check_max_retries = config.check_max_retries,
                        check_retry_backoff_ms = config.check_retry_backoff_ms,
                        cache_allow_ttl_ms = config.cache_allow_ttl_ms,
                        cache_deny_ttl_ms = config.cache_deny_ttl_ms,
                        policy_version = %config.policy_version,
                        schema_path = %config.schema_path,
                        supported_action_count = supported_actions.len(),
                        "AUTHZ_PROVIDER=spicedb runtime config is ready"
                    );

                    match SpiceDbHttpAuthorizer::new(&config) {
                        Ok(authorizer) => Arc::new(authorizer),
                        Err(reason) => {
                            warn!(
                                provider = "spicedb",
                                reason = %reason,
                                "failed to initialize spicedb authorizer; fail-close authorizer is active"
                            );
                            Arc::new(FailClosedAuthorizer::new(format!(
                                "spicedb_authorizer_init_failed:{reason}"
                            )))
                        }
                    }
                }
                Err(reason) => {
                    warn!(
                        provider = "spicedb",
                        reason = %reason,
                        "AUTHZ_PROVIDER=spicedb runtime config is invalid; fail-close authorizer is active"
                    );
                    Arc::new(FailClosedAuthorizer::new(format!(
                        "spicedb_runtime_config_invalid:{reason}"
                    )))
                }
            }
        }
        _ => {
            warn!(
                provider = %provider,
                supported_action_count = supported_actions.len(),
                "unknown AUTHZ_PROVIDER; fail-close authorizer is active"
            );
            Arc::new(FailClosedAuthorizer::new(format!(
                "unknown_authz_provider:{provider}"
            )))
        }
    }
}

/// 必須環境変数を非空文字列として読み取る。
/// @param name 環境変数名
/// @returns 読み取った文字列
/// @throws String 必須値が欠落または空の場合
fn parse_required_non_empty_env(name: &str) -> Result<String, String> {
    match env::var(name) {
        Ok(value) => {
            let trimmed = value.trim();
            if trimmed.is_empty() {
                return Err(format!("{name} is required and must not be empty"));
            }
            Ok(trimmed.to_owned())
        }
        Err(_) => Err(format!("{name} is required")),
    }
}

/// 任意環境変数を非空文字列として読み取り、未設定時は既定値を返す。
/// @param name 環境変数名
/// @param default 未設定時の既定値
/// @returns 読み取った文字列
/// @throws String 空文字列が設定されている場合
fn parse_optional_non_empty_env(name: &str, default: &str) -> Result<String, String> {
    match env::var(name) {
        Ok(value) => {
            let trimmed = value.trim();
            if trimmed.is_empty() {
                return Err(format!("{name} must not be empty when set"));
            }
            Ok(trimmed.to_owned())
        }
        Err(_) => Ok(default.to_owned()),
    }
}

/// 任意環境変数をu64として読み取り、未設定時は既定値を返す。
/// @param name 環境変数名
/// @param default 未設定時の既定値
/// @returns 読み取ったu64値
/// @throws String 数値変換に失敗した場合
fn parse_optional_u64_env(name: &str, default: u64) -> Result<u64, String> {
    match env::var(name) {
        Ok(value) => {
            let trimmed = value.trim();
            if trimmed.is_empty() {
                return Err(format!("{name} must not be empty when set"));
            }
            trimmed
                .parse::<u64>()
                .map_err(|error| format!("{name} must be a valid u64 (reason: {error})"))
        }
        Err(_) => Ok(default),
    }
}

/// 任意環境変数をu32として読み取り、未設定時は既定値を返す。
/// @param name 環境変数名
/// @param default 未設定時の既定値
/// @returns 読み取ったu32値
/// @throws String 数値変換に失敗した場合
fn parse_optional_u32_env(name: &str, default: u32) -> Result<u32, String> {
    match env::var(name) {
        Ok(value) => {
            let trimmed = value.trim();
            if trimmed.is_empty() {
                return Err(format!("{name} must not be empty when set"));
            }
            trimmed
                .parse::<u32>()
                .map_err(|error| format!("{name} must be a valid u32 (reason: {error})"))
        }
        Err(_) => Ok(default),
    }
}
