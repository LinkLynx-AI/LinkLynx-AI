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
