#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::OnceLock;

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

    #[test]
    fn authz_denied_maps_to_forbidden_and_ws_1008() {
        let error = AuthzError::denied("denied_by_policy");
        assert_eq!(error.status_code(), StatusCode::FORBIDDEN);
        assert_eq!(error.app_code(), "AUTHZ_DENIED");
        assert_eq!(error.ws_close_code(), 1008);
        assert_eq!(error.decision(), "deny");
    }

    #[test]
    fn authz_unavailable_maps_to_503_and_ws_1011() {
        let error = AuthzError::unavailable("dependency_down");
        assert_eq!(error.status_code(), StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(error.app_code(), "AUTHZ_UNAVAILABLE");
        assert_eq!(error.ws_close_code(), 1011);
        assert_eq!(error.decision(), "unavailable");
    }

    #[tokio::test]
    async fn runtime_provider_spicedb_falls_back_to_allow_all() {
        let _guard = env_lock().lock().await;
        let mut scoped = ScopedEnv::new();
        scoped.set("AUTHZ_PROVIDER", "spicedb");
        scoped.set("AUTHZ_ALLOW_ALL_UNTIL", "2026-06-30");

        let authorizer = build_runtime_authorizer();
        let input = AuthzCheckInput {
            principal_id: PrincipalId(1001),
            resource: AuthzResource::Session,
            action: AuthzAction::Connect,
        };

        assert!(authorizer.check(&input).await.is_ok());
    }

    #[tokio::test]
    async fn runtime_provider_unknown_falls_back_to_allow_all() {
        let _guard = env_lock().lock().await;
        let mut scoped = ScopedEnv::new();
        scoped.set("AUTHZ_PROVIDER", "unknown");
        scoped.set("AUTHZ_ALLOW_ALL_UNTIL", "2026-06-30");

        let authorizer = build_runtime_authorizer();
        let input = AuthzCheckInput {
            principal_id: PrincipalId(1001),
            resource: AuthzResource::RestPath {
                path: "/v1/protected/ping".to_owned(),
            },
            action: AuthzAction::View,
        };

        assert!(authorizer.check(&input).await.is_ok());
    }

    #[tokio::test]
    async fn runtime_provider_noop_deny_returns_denied() {
        let _guard = env_lock().lock().await;
        let mut scoped = ScopedEnv::new();
        scoped.set("AUTHZ_PROVIDER", "noop_deny");
        scoped.set("AUTHZ_ALLOW_ALL_UNTIL", "2026-06-30");

        let authorizer = build_runtime_authorizer();
        let input = AuthzCheckInput {
            principal_id: PrincipalId(1001),
            resource: AuthzResource::Session,
            action: AuthzAction::Connect,
        };

        let error = authorizer.check(&input).await.unwrap_err();
        assert_eq!(error.kind, AuthzErrorKind::Denied);
    }

    #[tokio::test]
    async fn runtime_provider_noop_unavailable_returns_unavailable() {
        let _guard = env_lock().lock().await;
        let mut scoped = ScopedEnv::new();
        scoped.set("AUTHZ_PROVIDER", "noop_unavailable");
        scoped.set("AUTHZ_ALLOW_ALL_UNTIL", "2026-06-30");

        let authorizer = build_runtime_authorizer();
        let input = AuthzCheckInput {
            principal_id: PrincipalId(1001),
            resource: AuthzResource::Session,
            action: AuthzAction::Connect,
        };

        let error = authorizer.check(&input).await.unwrap_err();
        assert_eq!(error.kind, AuthzErrorKind::DependencyUnavailable);
    }

    #[tokio::test]
    async fn spicedb_runtime_config_requires_preshared_key() {
        let _guard = env_lock().lock().await;
        let mut scoped = ScopedEnv::new();
        scoped.set("SPICEDB_ENDPOINT", "http://localhost:50051");
        scoped.unset("SPICEDB_PRESHARED_KEY");

        let error = build_spicedb_runtime_config_from_env().unwrap_err();
        assert!(
            error.contains("SPICEDB_PRESHARED_KEY is required"),
            "unexpected error: {error}"
        );
    }

    #[tokio::test]
    async fn spicedb_runtime_config_parses_valid_values() {
        let _guard = env_lock().lock().await;
        let mut scoped = ScopedEnv::new();
        scoped.set("SPICEDB_ENDPOINT", "http://spicedb:50051");
        scoped.set("SPICEDB_PRESHARED_KEY", "test-key");
        scoped.set("SPICEDB_REQUEST_TIMEOUT_MS", "1500");
        scoped.set("SPICEDB_SCHEMA_PATH", "database/contracts/lin862_spicedb_namespace_relation_permission_contract.md");

        let config = build_spicedb_runtime_config_from_env().unwrap();
        assert_eq!(config.endpoint, "http://spicedb:50051");
        assert_eq!(config.preshared_key, "test-key");
        assert_eq!(config.request_timeout_ms, 1500);
        assert_eq!(
            config.schema_path,
            "database/contracts/lin862_spicedb_namespace_relation_permission_contract.md"
        );
    }
}
