/// 実行時向けの message service を生成する。
/// @param なし
/// @returns message service
/// @throws なし
pub async fn build_runtime_message_service() -> Arc<dyn MessageService> {
    let database_url = match env::var("DATABASE_URL") {
        Ok(value) if !value.trim().is_empty() => value,
        _ => {
            warn!("DATABASE_URL missing; message service will fail-close as unavailable");
            return Arc::new(UnavailableMessageService::new(
                "message_metadata_unconfigured",
            ));
        }
    };

    let allow_postgres_notls = parse_runtime_bool_env("AUTH_ALLOW_POSTGRES_NOTLS", false);
    if !allow_postgres_notls {
        warn!(
            "AUTH_ALLOW_POSTGRES_NOTLS is false; message service stays fail-close until TLS connector is configured"
        );
        return Arc::new(UnavailableMessageService::new("postgres_tls_required"));
    }

    let scylla_config = match crate::scylla_health::build_scylla_runtime_config_from_env() {
        Ok(config) => config,
        Err(reason) => {
            warn!(
                reason = %reason,
                "Scylla runtime config is invalid; message service will fail-close as unavailable"
            );
            return Arc::new(UnavailableMessageService::new(
                "message_body_store_unconfigured",
            ));
        }
    };

    let session = match crate::scylla_health::build_runtime_scylla_session(&scylla_config).await {
        Ok(session) => session,
        Err(reason) => {
            warn!(
                reason = %reason,
                "Scylla runtime session initialization failed; message service will fail-close"
            );
            return Arc::new(UnavailableMessageService::new(
                "message_body_store_unavailable",
            ));
        }
    };

    let usecase: Arc<dyn MessageUsecase> = Arc::new(LiveMessageUsecase::new(
        Arc::new(ScyllaMessageStore::new(session, scylla_config.keyspace.clone())),
        Arc::new(PostgresMessageMetadataRepository::new(
            database_url,
            allow_postgres_notls,
        )),
    ));

    Arc::new(RuntimeMessageService::new(usecase))
}

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
