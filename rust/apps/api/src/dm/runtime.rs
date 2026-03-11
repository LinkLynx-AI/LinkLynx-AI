/// 実行時向けの DM サービスを生成する。
/// @param message_service message service
/// @returns DM service
/// @throws なし
pub fn build_runtime_dm_service(message_service: Arc<dyn MessageService>) -> Arc<dyn DmService> {
    let database_url = match env::var("DATABASE_URL") {
        Ok(value) if !value.trim().is_empty() => value,
        _ => {
            warn!("DATABASE_URL missing; dm service will fail-close as unavailable");
            return Arc::new(UnavailableDmService::new("dm_store_unconfigured"));
        }
    };

    let allow_postgres_notls = match env::var("AUTH_ALLOW_POSTGRES_NOTLS") {
        Ok(value) => matches!(value.trim().to_ascii_lowercase().as_str(), "1" | "true" | "yes" | "on"),
        Err(_) => false,
    };
    if !allow_postgres_notls {
        warn!(
            "AUTH_ALLOW_POSTGRES_NOTLS is false; dm service stays fail-close until TLS connector is configured"
        );
        return Arc::new(UnavailableDmService::new("postgres_tls_required"));
    }

    Arc::new(PostgresDmService::new(
        database_url,
        allow_postgres_notls,
        message_service,
    ))
}
