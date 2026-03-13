/// 実行時向けの user directory サービスを生成する。
/// @param なし
/// @returns user directory サービス
/// @throws なし
pub fn build_runtime_user_directory_service() -> Arc<dyn UserDirectoryService> {
    let database_url = match env::var("DATABASE_URL") {
        Ok(value) if !value.trim().is_empty() => value,
        _ => {
            warn!(
                "DATABASE_URL missing; user directory service will fail-close as unavailable"
            );
            return Arc::new(UnavailableUserDirectoryService::new(
                "user_directory_store_unconfigured",
            ));
        }
    };

    let allow_postgres_notls = parse_runtime_bool_env("AUTH_ALLOW_POSTGRES_NOTLS", false);
    if !allow_postgres_notls {
        warn!(
            "AUTH_ALLOW_POSTGRES_NOTLS is false; user directory service stays fail-close until TLS connector is configured"
        );
        return Arc::new(UnavailableUserDirectoryService::new("postgres_tls_required"));
    }

    Arc::new(PostgresUserDirectoryService::new(
        database_url,
        allow_postgres_notls,
    ))
}

/// 実行時bool環境変数を解釈する。
/// @param name 環境変数名
/// @param default 未設定時のデフォルト値
/// @returns 解釈結果
/// @throws なし
fn parse_runtime_bool_env(name: &str, default: bool) -> bool {
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
