/// 実行時向けのモデレーションサービスを生成する。
/// @param authorizer 認可境界
/// @returns モデレーションサービス
/// @throws なし
pub fn build_runtime_moderation_service(authorizer: Arc<dyn Authorizer>) -> Arc<dyn ModerationService> {
    let database_url = match env::var("DATABASE_URL") {
        Ok(value) if !value.trim().is_empty() => value,
        _ => {
            warn!("DATABASE_URL missing; moderation service will fail-close as unavailable");
            return Arc::new(UnavailableModerationService::new(
                "moderation_store_unconfigured",
            ));
        }
    };

    let allow_postgres_notls = parse_runtime_bool_env("AUTH_ALLOW_POSTGRES_NOTLS", false);
    if !allow_postgres_notls {
        warn!(
            "AUTH_ALLOW_POSTGRES_NOTLS is false; moderation service stays fail-close until TLS connector is configured"
        );
        return Arc::new(UnavailableModerationService::new("postgres_tls_required"));
    }

    Arc::new(PostgresModerationService::new(
        authorizer,
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
