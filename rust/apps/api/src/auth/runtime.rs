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
        Ok(value) => {
            let normalized = value.trim().to_ascii_lowercase();
            match normalized.as_str() {
                "1" | "true" | "yes" | "on" => true,
                "0" | "false" | "no" | "off" => false,
                _ => {
                    warn!(
                        env_var = %name,
                        value = %value,
                        default = default,
                        "invalid bool env value; fallback to default"
                    );
                    default
                }
            }
        }
        Err(_) => default,
    }
}
