/// 認証実行時の環境変数契約を検証する。
/// @param なし
/// @returns 検証成功時は `Ok(())`
/// @throws String 必須値欠落または不正値時
pub fn validate_runtime_auth_env() -> Result<(), String> {
    let mut errors = Vec::new();

    validate_required_non_empty_env("FIREBASE_PROJECT_ID", &mut errors);
    validate_required_non_empty_env("DATABASE_URL", &mut errors);
    validate_required_bool_env("AUTH_ALLOW_POSTGRES_NOTLS", &mut errors);

    validate_optional_non_empty_env("FIREBASE_AUDIENCE", &mut errors);
    validate_optional_non_empty_env("FIREBASE_ISSUER", &mut errors);
    validate_optional_url_env("FIREBASE_JWKS_URL", &mut errors);

    validate_optional_u64_env("FIREBASE_JWKS_TTL_SECONDS", &mut errors);
    validate_optional_u64_env("FIREBASE_HTTP_TIMEOUT_SECONDS", &mut errors);
    validate_optional_u64_env("FIREBASE_IAT_SKEW_SECONDS", &mut errors);
    validate_optional_u64_env("AUTH_PRINCIPAL_CACHE_TTL_SECONDS", &mut errors);
    validate_optional_u64_env("AUTH_PRINCIPAL_STORE_POOL_SIZE", &mut errors);
    validate_optional_u64_env("AUTH_PRINCIPAL_STORE_MAX_RETRIES", &mut errors);
    validate_optional_u64_env("AUTH_PRINCIPAL_STORE_RETRY_BASE_BACKOFF_MS", &mut errors);
    validate_optional_u64_env("WS_REAUTH_GRACE_SECONDS", &mut errors);
    validate_optional_u64_env("WS_TICKET_TTL_SECONDS", &mut errors);
    validate_optional_u64_env("AUTH_IDENTIFY_TIMEOUT_SECONDS", &mut errors);
    validate_optional_u64_env("WS_TICKET_RATE_LIMIT_MAX_PER_MINUTE", &mut errors);
    validate_optional_u64_env("WS_IDENTIFY_RATE_LIMIT_MAX_PER_MINUTE", &mut errors);
    validate_optional_ws_allowed_origins_env("WS_ALLOWED_ORIGINS", &mut errors);

    if errors.is_empty() {
        return Ok(());
    }

    Err(format!("runtime auth env validation failed: {}", errors.join("; ")))
}

fn validate_required_non_empty_env(name: &str, errors: &mut Vec<String>) {
    match env::var(name) {
        Ok(value) if !value.trim().is_empty() => {}
        Ok(_) => errors.push(format!("{name} is required and must not be empty")),
        Err(_) => errors.push(format!("{name} is required")),
    }
}

fn validate_optional_non_empty_env(name: &str, errors: &mut Vec<String>) {
    if let Ok(value) = env::var(name) {
        if value.trim().is_empty() {
            errors.push(format!("{name} must not be empty when set"));
        }
    }
}

fn validate_optional_url_env(name: &str, errors: &mut Vec<String>) {
    if let Ok(value) = env::var(name) {
        if value.trim().is_empty() {
            errors.push(format!("{name} must not be empty when set"));
            return;
        }

        if let Err(error) = reqwest::Url::parse(&value) {
            errors.push(format!("{name} must be a valid URL (reason: {error})"));
        }
    }
}

fn validate_optional_u64_env(name: &str, errors: &mut Vec<String>) {
    if let Ok(value) = env::var(name) {
        if value.trim().is_empty() {
            errors.push(format!("{name} must not be empty when set"));
            return;
        }

        if let Err(error) = value.parse::<u64>() {
            errors.push(format!("{name} must be a valid u64 (reason: {error})"));
        }
    }
}

fn validate_required_bool_env(name: &str, errors: &mut Vec<String>) {
    match env::var(name) {
        Ok(value) => {
            if parse_bool_value(&value).is_none() {
                errors.push(format!(
                    "{name} must be a valid bool (true/false/1/0/yes/no/on/off), got: {value}"
                ));
            }
        }
        Err(_) => errors.push(format!("{name} is required")),
    }
}

fn validate_optional_ws_allowed_origins_env(name: &str, errors: &mut Vec<String>) {
    if let Ok(value) = env::var(name) {
        if value.trim().is_empty() {
            errors.push(format!("{name} must not be empty when set"));
            return;
        }

        if let Err(reason) = parse_ws_origin_allowlist(&value) {
            errors.push(format!("{name} is invalid (reason: {reason})"));
        }
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

    let (principal_store, principal_provisioner) =
        build_runtime_principal_dependencies(Arc::clone(&metrics));
    let principal_cache = InMemoryPrincipalCache::default();
    let cache_ttl_seconds = parse_env_u64("AUTH_PRINCIPAL_CACHE_TTL_SECONDS", 300);

    let resolver: Arc<dyn PrincipalResolver> = Arc::new(CachingPrincipalResolver::new(
        FIREBASE_PROVIDER.to_owned(),
        Arc::new(principal_cache),
        principal_store,
        principal_provisioner,
        Duration::from_secs(cache_ttl_seconds),
        Arc::clone(&metrics),
    ));

    AuthService::new(verifier, resolver, metrics)
}

/// 実行時向けのprincipalストア/生成器を生成する。
/// @param metrics メトリクス集計器
/// @returns principalストア実装と生成器実装
/// @throws なし
fn build_runtime_principal_dependencies(
    metrics: Arc<AuthMetrics>,
) -> (Arc<dyn PrincipalStore>, Arc<dyn PrincipalProvisioner>) {
    match env::var("DATABASE_URL") {
        Ok(database_url) if !database_url.trim().is_empty() => {
            let postgres = Arc::new(PostgresPrincipalStore::new(database_url, metrics));
            (
                Arc::clone(&postgres) as Arc<dyn PrincipalStore>,
                postgres as Arc<dyn PrincipalProvisioner>,
            )
        }
        _ => {
            warn!("DATABASE_URL missing; principal store/provisioner will fail-close");
            (
                Arc::new(UnavailablePrincipalStore::new("principal_store_unconfigured")),
                Arc::new(UnavailablePrincipalProvisioner::new(
                    "principal_store_unconfigured",
                )),
            )
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
    match env::var(name) {
        Ok(value) => match value.parse::<u64>() {
            Ok(parsed) => parsed,
            Err(error) => {
                warn!(
                    env_var = %name,
                    value = %value,
                    reason = %error,
                    default = default,
                    "invalid u64 env value; fallback to default"
                );
                default
            }
        },
        Err(_) => default,
    }
}

fn parse_env_bool(name: &str, default: bool) -> bool {
    match env::var(name) {
        Ok(value) => match parse_bool_value(&value) {
            Some(parsed) => parsed,
            None => {
                warn!(
                    env_var = %name,
                    value = %value,
                    default = default,
                    "invalid bool env value; fallback to default"
                );
                default
            }
        },
        Err(_) => default,
    }
}

fn parse_bool_value(value: &str) -> Option<bool> {
    let normalized = value.trim().to_ascii_lowercase();
    match normalized.as_str() {
        "1" | "true" | "yes" | "on" => Some(true),
        "0" | "false" | "no" | "off" => Some(false),
        _ => None,
    }
}
