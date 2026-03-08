#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;
    use std::{
        env,
        sync::{Arc, OnceLock},
    };

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

    struct FakeScyllaHealthCheck {
        connectivity: Result<(), String>,
        keyspace_exists: Result<bool, String>,
        table_exists: Result<bool, String>,
    }

    #[async_trait]
    impl ScyllaHealthCheck for FakeScyllaHealthCheck {
        async fn verify_connectivity(&self) -> Result<(), String> {
            self.connectivity.clone()
        }

        async fn keyspace_exists(&self, _keyspace: &str) -> Result<bool, String> {
            self.keyspace_exists.clone()
        }

        async fn table_exists(
            &self,
            _keyspace: &str,
            _table_name: &str,
        ) -> Result<bool, String> {
            self.table_exists.clone()
        }
    }

    fn live_reporter_with_fake_check(
        fake_check: FakeScyllaHealthCheck,
    ) -> LiveScyllaHealthReporter {
        LiveScyllaHealthReporter::with_checker(Arc::new(fake_check), "chat".to_owned())
    }

    #[test]
    fn health_status_maps_http_statuses() {
        assert_eq!(ScyllaHealthStatus::Ready.http_status(), StatusCode::OK);
        assert_eq!(ScyllaHealthStatus::Degraded.http_status(), StatusCode::OK);
        assert_eq!(
            ScyllaHealthStatus::Error.http_status(),
            StatusCode::SERVICE_UNAVAILABLE
        );
    }

    #[tokio::test]
    async fn runtime_config_requires_hosts() {
        let _guard = env_lock().lock().await;
        let mut scoped = ScopedEnv::new();
        scoped.unset("SCYLLA_HOSTS");

        let error = build_scylla_runtime_config_from_env().unwrap_err();
        assert!(error.contains("SCYLLA_HOSTS is required"));
    }

    #[tokio::test]
    async fn runtime_config_requires_existing_schema_path() {
        let _guard = env_lock().lock().await;
        let mut scoped = ScopedEnv::new();
        scoped.set("SCYLLA_HOSTS", "localhost:9042");
        scoped.set("SCYLLA_SCHEMA_PATH", "database/scylla/missing.cql");

        let error = build_scylla_runtime_config_from_env().unwrap_err();
        assert!(error.contains("SCYLLA_SCHEMA_PATH not found"));
    }

    #[tokio::test]
    async fn runtime_config_parses_valid_values() {
        let _guard = env_lock().lock().await;
        let mut scoped = ScopedEnv::new();
        scoped.set("SCYLLA_HOSTS", "localhost:9042,127.0.0.1:9042");
        scoped.set("SCYLLA_KEYSPACE", "chat");
        scoped.set("SCYLLA_SCHEMA_PATH", "database/scylla/001_lin139_messages.cql");
        scoped.set("SCYLLA_REQUEST_TIMEOUT_MS", "2500");

        let config = build_scylla_runtime_config_from_env().unwrap();
        assert_eq!(
            config.hosts,
            vec!["localhost:9042".to_owned(), "127.0.0.1:9042".to_owned()]
        );
        assert_eq!(config.keyspace, "chat");
        assert!(
            config
                .schema_path
                .ends_with("database/scylla/001_lin139_messages.cql"),
            "unexpected schema path: {}",
            config.schema_path
        );
        assert_eq!(config.request_timeout_ms, 2500);
    }

    #[tokio::test]
    async fn unavailable_reporter_returns_error() {
        let reporter = UnavailableScyllaHealthReporter::new(SCYLLA_REASON_CONNECT_FAILED);
        let report = reporter.report().await;

        assert_eq!(report.status, ScyllaHealthStatus::Error);
        assert_eq!(
            report.reason,
            Some(SCYLLA_REASON_CONNECT_FAILED.to_owned())
        );
    }

    #[tokio::test]
    async fn live_reporter_returns_ready_when_baseline_schema_exists() {
        let reporter = live_reporter_with_fake_check(FakeScyllaHealthCheck {
            connectivity: Ok(()),
            keyspace_exists: Ok(true),
            table_exists: Ok(true),
        });

        let report = reporter.report().await;

        assert_eq!(report, ScyllaHealthReport::ready());
    }

    #[tokio::test]
    async fn live_reporter_returns_degraded_when_keyspace_is_missing() {
        let reporter = live_reporter_with_fake_check(FakeScyllaHealthCheck {
            connectivity: Ok(()),
            keyspace_exists: Ok(false),
            table_exists: Ok(true),
        });

        let report = reporter.report().await;

        assert_eq!(
            report,
            ScyllaHealthReport::degraded(SCYLLA_REASON_KEYSPACE_MISSING)
        );
    }

    #[tokio::test]
    async fn live_reporter_returns_degraded_when_table_is_missing() {
        let reporter = live_reporter_with_fake_check(FakeScyllaHealthCheck {
            connectivity: Ok(()),
            keyspace_exists: Ok(true),
            table_exists: Ok(false),
        });

        let report = reporter.report().await;

        assert_eq!(
            report,
            ScyllaHealthReport::degraded(SCYLLA_REASON_TABLE_MISSING)
        );
    }

    #[tokio::test]
    async fn live_reporter_sanitizes_runtime_query_timeout() {
        let reporter = live_reporter_with_fake_check(FakeScyllaHealthCheck {
            connectivity: Err("scylla_query_timeout:1000ms".to_owned()),
            keyspace_exists: Ok(true),
            table_exists: Ok(true),
        });

        let report = reporter.report().await;

        assert_eq!(report, ScyllaHealthReport::error(SCYLLA_REASON_QUERY_TIMEOUT));
    }

    #[tokio::test]
    async fn build_runtime_reporter_returns_error_reporter_for_invalid_config() {
        let _guard = env_lock().lock().await;
        let mut scoped = ScopedEnv::new();
        scoped.unset("SCYLLA_HOSTS");

        let reporter = build_runtime_scylla_health_reporter().await;
        let report = reporter.report().await;

        assert_eq!(report.status, ScyllaHealthStatus::Error);
        assert_eq!(report.reason, Some(SCYLLA_REASON_CONFIG_INVALID.to_owned()));
    }

    #[tokio::test]
    async fn build_runtime_reporter_returns_error_reporter_when_session_build_fails() {
        let _guard = env_lock().lock().await;
        let mut scoped = ScopedEnv::new();
        scoped.set("SCYLLA_HOSTS", "localhost:9042");
        scoped.set("SCYLLA_SCHEMA_PATH", "database/scylla/001_lin139_messages.cql");

        let config = build_scylla_runtime_config_from_env().unwrap();
        let reporter = build_runtime_scylla_health_reporter_from_parts(
            config,
            Err("scylla_connect_failed:connection refused".to_owned()),
        )
        .await;
        let report = reporter.report().await;

        assert_eq!(report.status, ScyllaHealthStatus::Error);
        assert_eq!(report.reason, Some(SCYLLA_REASON_CONNECT_FAILED.to_owned()));
    }
}
