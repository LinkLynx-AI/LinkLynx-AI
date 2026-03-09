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

    let metadata_repository = Arc::new(PostgresMessageMetadataRepository::new(
        database_url,
        allow_postgres_notls,
    ));
    let usecase: Arc<dyn MessageUsecase> = Arc::new(LiveMessageUsecase::new(
        Arc::new(ScyllaMessageStore::new(session, scylla_config.keyspace.clone())),
        metadata_repository.clone(),
        metadata_repository,
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

#[cfg(test)]
mod runtime_tests {
    use super::*;
    use std::{env, sync::OnceLock};

    fn env_lock() -> &'static tokio::sync::Mutex<()> {
        static ENV_LOCK: OnceLock<tokio::sync::Mutex<()>> = OnceLock::new();
        ENV_LOCK.get_or_init(|| tokio::sync::Mutex::new(()))
    }

    struct ScopedEnv {
        backups: Vec<(String, Option<String>)>,
    }

    impl ScopedEnv {
        fn new() -> Self {
            Self {
                backups: Vec::new(),
            }
        }

        fn set(&mut self, name: &str, value: &str) {
            if !self.backups.iter().any(|(saved, _)| saved == name) {
                self.backups.push((name.to_owned(), env::var(name).ok()));
            }
            env::set_var(name, value);
        }

        fn unset(&mut self, name: &str) {
            if !self.backups.iter().any(|(saved, _)| saved == name) {
                self.backups.push((name.to_owned(), env::var(name).ok()));
            }
            env::remove_var(name);
        }
    }

    impl Drop for ScopedEnv {
        fn drop(&mut self) {
            for (name, value) in self.backups.iter().rev() {
                if let Some(value) = value {
                    env::set_var(name, value);
                } else {
                    env::remove_var(name);
                }
            }
        }
    }

    #[tokio::test]
    async fn build_runtime_message_service_fails_close_when_database_url_is_missing() {
        let _guard = env_lock().lock().await;
        let mut scoped = ScopedEnv::new();
        scoped.unset("DATABASE_URL");
        scoped.set("AUTH_ALLOW_POSTGRES_NOTLS", "true");
        scoped.set("SCYLLA_HOSTS", "127.0.0.1:9042");
        scoped.set("SCYLLA_SCHEMA_PATH", "database/scylla/001_lin139_messages.cql");

        let service = build_runtime_message_service().await;
        let error = service
            .list_guild_channel_messages(
                10,
                20,
                ListGuildChannelMessagesQueryV1 {
                    limit: Some(1),
                    before: None,
                    after: None,
                },
            )
            .await
            .unwrap_err();

        assert_eq!(
            error.reason,
            "message_metadata_unconfigured",
            "message service should fail-close when DATABASE_URL is missing"
        );
    }

    #[tokio::test]
    async fn build_runtime_message_service_fails_close_when_scylla_is_unreachable() {
        let _guard = env_lock().lock().await;
        let mut scoped = ScopedEnv::new();
        scoped.set(
            "DATABASE_URL",
            "postgres://postgres:password@localhost:5432/linklynx",
        );
        scoped.set("AUTH_ALLOW_POSTGRES_NOTLS", "true");
        scoped.set("SCYLLA_HOSTS", "127.0.0.1:9043");
        scoped.set("SCYLLA_SCHEMA_PATH", "database/scylla/001_lin139_messages.cql");
        scoped.set("SCYLLA_REQUEST_TIMEOUT_MS", "50");

        let service = build_runtime_message_service().await;
        let error = service
            .create_guild_channel_message(
                PrincipalId(9003),
                10,
                20,
                None,
                CreateGuildChannelMessageRequestV1 {
                    content: "hello unavailable".to_owned(),
                },
            )
            .await
            .unwrap_err();

        assert_eq!(
            error.reason,
            "message_body_store_unavailable",
            "message service should fail-close when Scylla cannot be reached"
        );
    }

    #[tokio::test]
    async fn parse_runtime_bool_env_accepts_true_like_values() {
        let _guard = env_lock().lock().await;
        let mut scoped = ScopedEnv::new();
        scoped.set("MESSAGE_BOOL_TEST", "yes");

        assert!(parse_runtime_bool_env("MESSAGE_BOOL_TEST", false));
    }

    #[tokio::test]
    async fn parse_runtime_bool_env_falls_back_for_invalid_values() {
        let _guard = env_lock().lock().await;
        let mut scoped = ScopedEnv::new();
        scoped.set("MESSAGE_BOOL_TEST", "maybe");

        assert!(parse_runtime_bool_env("MESSAGE_BOOL_TEST", true));
    }
}
