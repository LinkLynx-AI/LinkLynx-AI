#[cfg(test)]
mod tests {
    use super::*;
    use axum::{extract::State, routing::post, Json, Router};
    use serde_json::json;
    use std::sync::{
        atomic::{AtomicU64, Ordering},
        Arc, OnceLock,
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
    async fn runtime_provider_spicedb_returns_unavailable_when_dependency_unreachable() {
        let _guard = env_lock().lock().await;
        let mut scoped = ScopedEnv::new();
        scoped.set("AUTHZ_PROVIDER", "spicedb");
        scoped.set("SPICEDB_ENDPOINT", "http://spicedb:50051");
        scoped.set("SPICEDB_CHECK_ENDPOINT", "http://127.0.0.1:9");
        scoped.set("SPICEDB_PRESHARED_KEY", "test-key");
        scoped.set("SPICEDB_REQUEST_TIMEOUT_MS", "10");
        scoped.set("SPICEDB_CHECK_MAX_RETRIES", "0");

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
    async fn runtime_provider_unknown_is_fail_closed() {
        let _guard = env_lock().lock().await;
        let mut scoped = ScopedEnv::new();
        scoped.set("AUTHZ_PROVIDER", "unknown");

        let authorizer = build_runtime_authorizer();
        let input = AuthzCheckInput {
            principal_id: PrincipalId(1001),
            resource: AuthzResource::RestPath {
                path: "/protected/ping".to_owned(),
            },
            action: AuthzAction::View,
        };

        let error = authorizer.check(&input).await.unwrap_err();
        assert_eq!(error.kind, AuthzErrorKind::DependencyUnavailable);
    }

    #[tokio::test]
    async fn runtime_provider_default_uses_noop_allow() {
        let _guard = env_lock().lock().await;
        let mut scoped = ScopedEnv::new();
        scoped.unset("AUTHZ_PROVIDER");
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
        scoped.set("SPICEDB_CHECK_ENDPOINT", "http://localhost:8443");
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
        scoped.set("SPICEDB_CHECK_ENDPOINT", "http://spicedb:8443");
        scoped.set("SPICEDB_PRESHARED_KEY", "test-key");
        scoped.set("SPICEDB_REQUEST_TIMEOUT_MS", "1500");
        scoped.set("SPICEDB_CHECK_MAX_RETRIES", "2");
        scoped.set("SPICEDB_CHECK_RETRY_BACKOFF_MS", "120");
        scoped.set("AUTHZ_CACHE_ALLOW_TTL_MS", "4000");
        scoped.set("AUTHZ_CACHE_DENY_TTL_MS", "900");
        scoped.set("AUTHZ_CACHE_MAX_ENTRIES", "123");
        scoped.set("SPICEDB_POLICY_VERSION", "lin862-v1-test");
        scoped.set("SPICEDB_SCHEMA_PATH", "database/contracts/lin862_spicedb_namespace_relation_permission_contract.md");

        let config = build_spicedb_runtime_config_from_env().unwrap();
        assert_eq!(config.endpoint, "http://spicedb:50051");
        assert_eq!(config.check_endpoint, "http://spicedb:8443");
        assert_eq!(config.preshared_key, "test-key");
        assert_eq!(config.request_timeout_ms, 1500);
        assert_eq!(config.check_max_retries, 2);
        assert_eq!(config.check_retry_backoff_ms, 120);
        assert_eq!(config.cache_allow_ttl_ms, 4000);
        assert_eq!(config.cache_deny_ttl_ms, 900);
        assert_eq!(config.cache_max_entries, 123);
        assert_eq!(config.policy_version, "lin862-v1-test");
        assert_eq!(
            config.schema_path,
            "database/contracts/lin862_spicedb_namespace_relation_permission_contract.md"
        );
    }

    #[tokio::test]
    async fn runtime_provider_spicedb_maps_has_permission_to_allow() {
        let _guard = env_lock().lock().await;
        let mock = MockSpiceDbServer::start(
            vec![MockSpiceDbResponse::ok("PERMISSIONSHIP_HAS_PERMISSION")],
            false,
        )
        .await;
        let mut scoped = ScopedEnv::new();
        scoped.set("AUTHZ_PROVIDER", "spicedb");
        scoped.set("SPICEDB_ENDPOINT", "http://spicedb:50051");
        scoped.set("SPICEDB_CHECK_ENDPOINT", &mock.endpoint());
        scoped.set("SPICEDB_PRESHARED_KEY", "test-key");
        scoped.set("SPICEDB_REQUEST_TIMEOUT_MS", "100");
        scoped.set("SPICEDB_CHECK_MAX_RETRIES", "0");

        let authorizer = build_runtime_authorizer();
        let input = AuthzCheckInput {
            principal_id: PrincipalId(2001),
            resource: AuthzResource::Session,
            action: AuthzAction::Connect,
        };
        assert!(authorizer.check(&input).await.is_ok());
        assert_eq!(mock.request_count(), 1);
    }

    #[tokio::test]
    async fn runtime_provider_spicedb_maps_no_permission_to_deny() {
        let _guard = env_lock().lock().await;
        let mock = MockSpiceDbServer::start(
            vec![MockSpiceDbResponse::ok("PERMISSIONSHIP_NO_PERMISSION")],
            false,
        )
        .await;
        let mut scoped = ScopedEnv::new();
        scoped.set("AUTHZ_PROVIDER", "spicedb");
        scoped.set("SPICEDB_ENDPOINT", "http://spicedb:50051");
        scoped.set("SPICEDB_CHECK_ENDPOINT", &mock.endpoint());
        scoped.set("SPICEDB_PRESHARED_KEY", "test-key");
        scoped.set("SPICEDB_REQUEST_TIMEOUT_MS", "100");
        scoped.set("SPICEDB_CHECK_MAX_RETRIES", "0");

        let authorizer = build_runtime_authorizer();
        let input = AuthzCheckInput {
            principal_id: PrincipalId(2001),
            resource: AuthzResource::Session,
            action: AuthzAction::Connect,
        };
        let error = authorizer.check(&input).await.unwrap_err();
        assert_eq!(error.kind, AuthzErrorKind::Denied);
        assert_eq!(mock.request_count(), 1);
    }

    #[tokio::test]
    async fn runtime_provider_spicedb_uses_cache_for_repeat_checks() {
        let _guard = env_lock().lock().await;
        let mock = MockSpiceDbServer::start(
            vec![MockSpiceDbResponse::ok("PERMISSIONSHIP_HAS_PERMISSION")],
            false,
        )
        .await;
        let mut scoped = ScopedEnv::new();
        scoped.set("AUTHZ_PROVIDER", "spicedb");
        scoped.set("SPICEDB_ENDPOINT", "http://spicedb:50051");
        scoped.set("SPICEDB_CHECK_ENDPOINT", &mock.endpoint());
        scoped.set("SPICEDB_PRESHARED_KEY", "test-key");
        scoped.set("SPICEDB_REQUEST_TIMEOUT_MS", "100");
        scoped.set("SPICEDB_CHECK_MAX_RETRIES", "0");
        scoped.set("AUTHZ_CACHE_ALLOW_TTL_MS", "5000");

        let authorizer = build_runtime_authorizer();
        let input = AuthzCheckInput {
            principal_id: PrincipalId(3001),
            resource: AuthzResource::RestPath {
                path: "/v1/protected/ping".to_owned(),
            },
            action: AuthzAction::View,
        };

        assert!(authorizer.check(&input).await.is_ok());
        assert!(authorizer.check(&input).await.is_ok());
        assert_eq!(mock.request_count(), 1);
    }

    #[tokio::test]
    async fn spicedb_runtime_config_rejects_zero_cache_max_entries() {
        let _guard = env_lock().lock().await;
        let mut scoped = ScopedEnv::new();
        scoped.set("SPICEDB_ENDPOINT", "http://spicedb:50051");
        scoped.set("SPICEDB_CHECK_ENDPOINT", "http://spicedb:8443");
        scoped.set("SPICEDB_PRESHARED_KEY", "test-key");
        scoped.set("AUTHZ_CACHE_MAX_ENTRIES", "0");

        let error = build_spicedb_runtime_config_from_env().unwrap_err();
        assert!(error.contains("AUTHZ_CACHE_MAX_ENTRIES"));
        assert!(error.contains("greater than 0"));
    }

    #[tokio::test]
    async fn runtime_provider_spicedb_invalidation_event_evicts_cached_entry_immediately() {
        let _guard = env_lock().lock().await;
        let mock = MockSpiceDbServer::start(
            vec![
                MockSpiceDbResponse::ok("PERMISSIONSHIP_HAS_PERMISSION"),
                MockSpiceDbResponse::ok("PERMISSIONSHIP_HAS_PERMISSION"),
                MockSpiceDbResponse::ok("PERMISSIONSHIP_HAS_PERMISSION"),
                MockSpiceDbResponse::ok("PERMISSIONSHIP_HAS_PERMISSION"),
                MockSpiceDbResponse::ok("PERMISSIONSHIP_NO_PERMISSION"),
            ],
            false,
        )
        .await;

        let config = SpiceDbRuntimeConfig {
            endpoint: "http://spicedb:50051".to_owned(),
            check_endpoint: mock.endpoint(),
            preshared_key: "test-key".to_owned(),
            request_timeout_ms: 100,
            check_max_retries: 0,
            check_retry_backoff_ms: 10,
            cache_allow_ttl_ms: 60_000,
            cache_deny_ttl_ms: 60_000,
            cache_max_entries: 100,
            policy_version: "lin862-v1".to_owned(),
            schema_path:
                "database/contracts/lin862_spicedb_namespace_relation_permission_contract.md"
                    .to_owned(),
        };
        let authorizer = SpiceDbHttpAuthorizer::new(&config).unwrap();

        let input = AuthzCheckInput {
            principal_id: PrincipalId(3200),
            resource: AuthzResource::GuildChannel {
                guild_id: 10,
                channel_id: 77,
            },
            action: AuthzAction::View,
        };

        assert!(authorizer.check(&input).await.is_ok());
        assert!(authorizer.check(&input).await.is_ok());
        assert_eq!(mock.request_count(), 3);

        let report = authorizer
            .apply_cache_invalidation_event(&AuthzCacheInvalidationEvent {
                kind: AuthzCacheInvalidationEventKind::ChannelRoleOverrideChanged {
                    guild_id: 10,
                    channel_id: 77,
                },
                occurred_at: std::time::SystemTime::now(),
            })
            .await;
        assert_eq!(report.evicted_keys, 1);

        let error = authorizer.check(&input).await.unwrap_err();
        assert_eq!(error.kind, AuthzErrorKind::Denied);
        assert_eq!(mock.request_count(), 5);

        let metrics = authorizer.invalidation_metrics_snapshot();
        assert_eq!(metrics.events_total, 1);
        assert_eq!(metrics.evicted_keys_total, 1);
    }

    #[tokio::test]
    async fn runtime_provider_spicedb_cache_max_entries_bounds_growth() {
        let _guard = env_lock().lock().await;
        let mock = MockSpiceDbServer::start(
            vec![
                MockSpiceDbResponse::ok("PERMISSIONSHIP_HAS_PERMISSION"),
                MockSpiceDbResponse::ok("PERMISSIONSHIP_HAS_PERMISSION"),
                MockSpiceDbResponse::ok("PERMISSIONSHIP_HAS_PERMISSION"),
            ],
            false,
        )
        .await;

        let config = SpiceDbRuntimeConfig {
            endpoint: "http://spicedb:50051".to_owned(),
            check_endpoint: mock.endpoint(),
            preshared_key: "test-key".to_owned(),
            request_timeout_ms: 100,
            check_max_retries: 0,
            check_retry_backoff_ms: 10,
            cache_allow_ttl_ms: 60_000,
            cache_deny_ttl_ms: 60_000,
            cache_max_entries: 1,
            policy_version: "lin862-v1".to_owned(),
            schema_path:
                "database/contracts/lin862_spicedb_namespace_relation_permission_contract.md"
                    .to_owned(),
        };
        let authorizer = SpiceDbHttpAuthorizer::new(&config).unwrap();

        let first = AuthzCheckInput {
            principal_id: PrincipalId(4301),
            resource: AuthzResource::Guild { guild_id: 1 },
            action: AuthzAction::View,
        };
        let second = AuthzCheckInput {
            principal_id: PrincipalId(4302),
            resource: AuthzResource::Guild { guild_id: 2 },
            action: AuthzAction::View,
        };

        assert!(authorizer.check(&first).await.is_ok());
        assert!(authorizer.check(&second).await.is_ok());
        assert!(authorizer.check(&first).await.is_ok());
        assert_eq!(mock.request_count(), 3);
    }

    #[tokio::test]
    async fn runtime_provider_spicedb_maps_guild_manage_to_can_manage() {
        let _guard = env_lock().lock().await;
        let mock = MockSpiceDbServer::start(
            vec![MockSpiceDbResponse::ok("PERMISSIONSHIP_HAS_PERMISSION")],
            false,
        )
        .await;
        let mut scoped = ScopedEnv::new();
        scoped.set("AUTHZ_PROVIDER", "spicedb");
        scoped.set("SPICEDB_ENDPOINT", "http://spicedb:50051");
        scoped.set("SPICEDB_CHECK_ENDPOINT", &mock.endpoint());
        scoped.set("SPICEDB_PRESHARED_KEY", "test-key");
        scoped.set("SPICEDB_REQUEST_TIMEOUT_MS", "100");
        scoped.set("SPICEDB_CHECK_MAX_RETRIES", "0");

        let authorizer = build_runtime_authorizer();
        let input = AuthzCheckInput {
            principal_id: PrincipalId(4001),
            resource: AuthzResource::Guild { guild_id: 99 },
            action: AuthzAction::Manage,
        };

        assert!(authorizer.check(&input).await.is_ok());
        assert_eq!(mock.request_count(), 1);
        let requests = mock.requests().await;
        assert_eq!(requests.len(), 1);
        assert_eq!(requests[0]["resource"]["objectType"], "guild");
        assert_eq!(requests[0]["resource"]["objectId"], "99");
        assert_eq!(requests[0]["permission"], "can_manage");
    }

    #[tokio::test]
    async fn runtime_provider_spicedb_maps_channel_post_to_can_post() {
        let _guard = env_lock().lock().await;
        let mock = MockSpiceDbServer::start(
            vec![
                MockSpiceDbResponse::ok("PERMISSIONSHIP_HAS_PERMISSION"),
                MockSpiceDbResponse::ok("PERMISSIONSHIP_HAS_PERMISSION"),
            ],
            false,
        )
        .await;
        let mut scoped = ScopedEnv::new();
        scoped.set("AUTHZ_PROVIDER", "spicedb");
        scoped.set("SPICEDB_ENDPOINT", "http://spicedb:50051");
        scoped.set("SPICEDB_CHECK_ENDPOINT", &mock.endpoint());
        scoped.set("SPICEDB_PRESHARED_KEY", "test-key");
        scoped.set("SPICEDB_REQUEST_TIMEOUT_MS", "100");
        scoped.set("SPICEDB_CHECK_MAX_RETRIES", "0");

        let authorizer = build_runtime_authorizer();
        let input = AuthzCheckInput {
            principal_id: PrincipalId(4002),
            resource: AuthzResource::GuildChannel {
                guild_id: 10,
                channel_id: 77,
            },
            action: AuthzAction::Post,
        };

        assert!(authorizer.check(&input).await.is_ok());
        assert_eq!(mock.request_count(), 2);
        let requests = mock.requests().await;
        assert_eq!(requests.len(), 2);
        assert_eq!(requests[0]["resource"]["objectType"], "channel");
        assert_eq!(requests[0]["resource"]["objectId"], "77");
        assert_eq!(requests[0]["permission"], "guild");
        assert_eq!(requests[0]["subject"]["object"]["objectType"], "guild");
        assert_eq!(requests[0]["subject"]["object"]["objectId"], "10");
        assert_eq!(requests[1]["resource"]["objectType"], "channel");
        assert_eq!(requests[1]["resource"]["objectId"], "77");
        assert_eq!(requests[1]["permission"], "can_post");
    }

    #[tokio::test]
    async fn runtime_provider_spicedb_denies_cross_guild_channel_mismatch() {
        let _guard = env_lock().lock().await;
        let mock = MockSpiceDbServer::start(
            vec![MockSpiceDbResponse::ok("PERMISSIONSHIP_NO_PERMISSION")],
            false,
        )
        .await;
        let mut scoped = ScopedEnv::new();
        scoped.set("AUTHZ_PROVIDER", "spicedb");
        scoped.set("SPICEDB_ENDPOINT", "http://spicedb:50051");
        scoped.set("SPICEDB_CHECK_ENDPOINT", &mock.endpoint());
        scoped.set("SPICEDB_PRESHARED_KEY", "test-key");
        scoped.set("SPICEDB_REQUEST_TIMEOUT_MS", "100");
        scoped.set("SPICEDB_CHECK_MAX_RETRIES", "0");

        let authorizer = build_runtime_authorizer();
        let input = AuthzCheckInput {
            principal_id: PrincipalId(4501),
            resource: AuthzResource::GuildChannel {
                guild_id: 999,
                channel_id: 77,
            },
            action: AuthzAction::View,
        };

        let error = authorizer.check(&input).await.unwrap_err();
        assert_eq!(error.kind, AuthzErrorKind::Denied);
        assert_eq!(error.reason, "spicedb_channel_guild_mismatch");
        assert_eq!(mock.request_count(), 1);
        let requests = mock.requests().await;
        assert_eq!(requests.len(), 1);
        assert_eq!(requests[0]["permission"], "guild");
        assert_eq!(requests[0]["subject"]["object"]["objectType"], "guild");
        assert_eq!(requests[0]["subject"]["object"]["objectId"], "999");
    }

    #[tokio::test]
    async fn runtime_provider_spicedb_denies_guild_channel_not_found() {
        let _guard = env_lock().lock().await;
        let mock = MockSpiceDbServer::start(
            vec![MockSpiceDbResponse::ok("PERMISSIONSHIP_NO_PERMISSION")],
            false,
        )
        .await;
        let mut scoped = ScopedEnv::new();
        scoped.set("AUTHZ_PROVIDER", "spicedb");
        scoped.set("SPICEDB_ENDPOINT", "http://spicedb:50051");
        scoped.set("SPICEDB_CHECK_ENDPOINT", &mock.endpoint());
        scoped.set("SPICEDB_PRESHARED_KEY", "test-key");
        scoped.set("SPICEDB_REQUEST_TIMEOUT_MS", "100");
        scoped.set("SPICEDB_CHECK_MAX_RETRIES", "0");

        let authorizer = build_runtime_authorizer();
        let input = AuthzCheckInput {
            principal_id: PrincipalId(4502),
            resource: AuthzResource::GuildChannel {
                guild_id: 10,
                channel_id: 999_999,
            },
            action: AuthzAction::Post,
        };

        let error = authorizer.check(&input).await.unwrap_err();
        assert_eq!(error.kind, AuthzErrorKind::Denied);
        assert_eq!(error.reason, "spicedb_channel_guild_mismatch");
        assert_eq!(mock.request_count(), 1);
    }

    #[tokio::test]
    async fn runtime_provider_spicedb_rechecks_guild_consistency_on_cache_hit() {
        let _guard = env_lock().lock().await;
        let mock = MockSpiceDbServer::start(
            vec![
                MockSpiceDbResponse::ok("PERMISSIONSHIP_HAS_PERMISSION"),
                MockSpiceDbResponse::ok("PERMISSIONSHIP_HAS_PERMISSION"),
                MockSpiceDbResponse::ok("PERMISSIONSHIP_NO_PERMISSION"),
            ],
            false,
        )
        .await;

        let config = SpiceDbRuntimeConfig {
            endpoint: "http://spicedb:50051".to_owned(),
            check_endpoint: mock.endpoint(),
            preshared_key: "test-key".to_owned(),
            request_timeout_ms: 100,
            check_max_retries: 0,
            check_retry_backoff_ms: 10,
            cache_allow_ttl_ms: 60_000,
            cache_deny_ttl_ms: 60_000,
            cache_max_entries: 100,
            policy_version: "lin862-v1".to_owned(),
            schema_path:
                "database/contracts/lin862_spicedb_namespace_relation_permission_contract.md"
                    .to_owned(),
        };
        let authorizer = SpiceDbHttpAuthorizer::new(&config).unwrap();
        let input = AuthzCheckInput {
            principal_id: PrincipalId(4600),
            resource: AuthzResource::GuildChannel {
                guild_id: 10,
                channel_id: 77,
            },
            action: AuthzAction::View,
        };

        assert!(authorizer.check(&input).await.is_ok());
        let error = authorizer.check(&input).await.unwrap_err();
        assert_eq!(error.kind, AuthzErrorKind::Denied);
        assert_eq!(error.reason, "spicedb_channel_guild_mismatch");
        assert_eq!(mock.request_count(), 3);
    }

    #[tokio::test]
    async fn runtime_provider_spicedb_maps_dm_channel_post_to_can_post() {
        let _guard = env_lock().lock().await;
        let mock = MockSpiceDbServer::start(
            vec![MockSpiceDbResponse::ok("PERMISSIONSHIP_HAS_PERMISSION")],
            false,
        )
        .await;
        let mut scoped = ScopedEnv::new();
        scoped.set("AUTHZ_PROVIDER", "spicedb");
        scoped.set("SPICEDB_ENDPOINT", "http://spicedb:50051");
        scoped.set("SPICEDB_CHECK_ENDPOINT", &mock.endpoint());
        scoped.set("SPICEDB_PRESHARED_KEY", "test-key");
        scoped.set("SPICEDB_REQUEST_TIMEOUT_MS", "100");
        scoped.set("SPICEDB_CHECK_MAX_RETRIES", "0");

        let authorizer = build_runtime_authorizer();
        let input = AuthzCheckInput {
            principal_id: PrincipalId(4003),
            resource: AuthzResource::Channel { channel_id: 88 },
            action: AuthzAction::Post,
        };

        assert!(authorizer.check(&input).await.is_ok());
        assert_eq!(mock.request_count(), 1);
        let requests = mock.requests().await;
        assert_eq!(requests.len(), 1);
        assert_eq!(requests[0]["resource"]["objectType"], "channel");
        assert_eq!(requests[0]["resource"]["objectId"], "88");
        assert_eq!(requests[0]["permission"], "can_post");
    }

    #[test]
    fn tuple_mapping_uses_canonical_relations() {
        let role_row = GuildRolePermissionRow {
            guild_id: 10,
            role_key: "member".to_owned(),
            allow_view: true,
            allow_post: true,
            allow_manage: false,
        };
        let channel_role_row = ChannelRoleOverrideRow {
            channel_id: 200,
            guild_id: 10,
            role_key: "member".to_owned(),
            can_view: Some(false),
            can_post: Some(true),
        };
        let channel_user_row = ChannelUserOverrideRow {
            channel_id: 200,
            guild_id: 10,
            user_id: 3000,
            can_view: Some(true),
            can_post: Some(false),
        };

        let mut tuples = Vec::new();
        tuples.extend(map_guild_role_permissions_to_tuples(&role_row));
        tuples.extend(map_channel_role_override_to_tuples(&channel_role_row));
        tuples.extend(map_channel_user_override_to_tuples(&channel_user_row));

        let compact: std::collections::BTreeSet<String> =
            tuples.iter().map(SpiceDbTuple::compact).collect();

        assert!(compact.contains("guild:10#viewer@role:10/member#member"));
        assert!(compact.contains("guild:10#poster@role:10/member#member"));
        assert!(compact.contains("channel:200#view_deny_role@role:10/member#member"));
        assert!(compact.contains("channel:200#poster_role@role:10/member#member"));
        assert!(compact.contains("channel:200#viewer_user@user:3000"));
        assert!(compact.contains("channel:200#post_deny_user@user:3000"));
        assert!(compact.contains("channel:200#guild@guild:10"));
    }

    #[test]
    fn backfill_builder_deduplicates_tuples() {
        let input = TupleBackfillInput {
            guild_roles: vec![GuildRolePermissionRow {
                guild_id: 99,
                role_key: "admin".to_owned(),
                allow_view: true,
                allow_post: true,
                allow_manage: true,
            }],
            guild_member_roles: vec![
                GuildMemberRoleRow {
                    guild_id: 99,
                    user_id: 7,
                    role_key: "admin".to_owned(),
                },
                GuildMemberRoleRow {
                    guild_id: 99,
                    user_id: 7,
                    role_key: "admin".to_owned(),
                },
            ],
            channel_role_overrides: vec![],
            channel_user_overrides: vec![],
        };

        let tuples = build_backfill_tuples(&input);
        let compact: std::collections::BTreeSet<String> =
            tuples.iter().map(SpiceDbTuple::compact).collect();
        assert_eq!(tuples.len(), compact.len());
        assert!(compact.contains("role:99/admin#member@user:7"));
        assert!(compact.contains("guild:99#manager@role:99/admin#member"));
        assert!(compact.contains("guild:99#viewer@role:99/admin#member"));
        assert!(compact.contains("guild:99#poster@role:99/admin#member"));
    }

    #[test]
    fn tuple_sync_command_parses_role_event_and_builds_replace_mutations() {
        let event = TupleSyncOutboxEvent {
            id: 101,
            event_type: AUTHZ_TUPLE_EVENT_GUILD_ROLE.to_owned(),
            aggregate_id: "guild:44/role:member".to_owned(),
            payload: json!({
                "op": "upsert",
                "guild_id": 44,
                "role_key": "member",
                "allow_view": true,
                "allow_post": false,
                "allow_manage": false
            }),
        };

        let command = build_tuple_sync_command(&event).unwrap();
        let TupleSyncCommand::Mutations(mutations) = command else {
            panic!("unexpected sync command");
        };

        let compact: std::collections::BTreeSet<String> = mutations
            .iter()
            .map(|mutation| match mutation {
                SpiceDbTupleMutation::Delete(tuple) => format!("delete:{}", tuple.compact()),
                SpiceDbTupleMutation::Upsert(tuple) => format!("upsert:{}", tuple.compact()),
            })
            .collect();

        assert!(compact.contains("delete:guild:44#manager@role:44/member#member"));
        assert!(compact.contains("delete:guild:44#viewer@role:44/member#member"));
        assert!(compact.contains("delete:guild:44#poster@role:44/member#member"));
        assert!(compact.contains("upsert:guild:44#viewer@role:44/member#member"));
        assert_eq!(compact.len(), 4);
    }

    #[test]
    fn tuple_sync_command_channel_override_upsert_includes_channel_guild_tuple() {
        let event = TupleSyncOutboxEvent {
            id: 102,
            event_type: AUTHZ_TUPLE_EVENT_CHANNEL_ROLE_OVERRIDE.to_owned(),
            aggregate_id: "channel:200/role:member".to_owned(),
            payload: json!({
                "op": "upsert",
                "channel_id": 200,
                "guild_id": 10,
                "role_key": "member",
                "can_view": null,
                "can_post": null
            }),
        };

        let command = build_tuple_sync_command(&event).unwrap();
        let TupleSyncCommand::Mutations(mutations) = command else {
            panic!("unexpected sync command");
        };

        let compact: std::collections::BTreeSet<String> = mutations
            .iter()
            .map(|mutation| match mutation {
                SpiceDbTupleMutation::Delete(tuple) => format!("delete:{}", tuple.compact()),
                SpiceDbTupleMutation::Upsert(tuple) => format!("upsert:{}", tuple.compact()),
            })
            .collect();

        assert!(compact.contains("upsert:channel:200#guild@guild:10"));
    }

    #[test]
    fn tuple_sync_command_rejects_partial_channel_role_override_upsert_payload() {
        let event = TupleSyncOutboxEvent {
            id: 103,
            event_type: AUTHZ_TUPLE_EVENT_CHANNEL_ROLE_OVERRIDE.to_owned(),
            aggregate_id: "channel:200/role:member".to_owned(),
            payload: json!({
                "op": "upsert",
                "channel_id": 200,
                "guild_id": 10,
                "role_key": "member",
                "can_view": true
            }),
        };

        let error = build_tuple_sync_command(&event).unwrap_err();
        assert!(error.contains("requires field: can_post"));
    }

    #[test]
    fn tuple_sync_command_rejects_partial_channel_user_override_upsert_payload() {
        let event = TupleSyncOutboxEvent {
            id: 104,
            event_type: AUTHZ_TUPLE_EVENT_CHANNEL_USER_OVERRIDE.to_owned(),
            aggregate_id: "channel:200/user:3000".to_owned(),
            payload: json!({
                "op": "upsert",
                "channel_id": 200,
                "guild_id": 10,
                "user_id": 3000,
                "can_post": false
            }),
        };

        let error = build_tuple_sync_command(&event).unwrap_err();
        assert!(error.contains("requires field: can_view"));
    }

    #[test]
    fn tuple_drift_report_and_resync_mutation_are_consistent() {
        let expected = vec![
            SpiceDbTuple::new("guild:1", "viewer", "role:1/member#member"),
            SpiceDbTuple::new("guild:1", "poster", "role:1/member#member"),
        ];
        let observed = vec![
            SpiceDbTuple::new("guild:1", "viewer", "role:1/member#member"),
            SpiceDbTuple::new("guild:1", "manager", "role:1/member#member"),
        ];

        let report = detect_tuple_drift(&expected, &observed);
        assert!(report.has_drift());
        assert_eq!(report.missing_tuples.len(), 1);
        assert_eq!(report.unexpected_tuples.len(), 1);

        let mutations = build_resync_mutations(&report);
        assert_eq!(mutations.len(), 2);
    }

    #[tokio::test]
    async fn tuple_sync_service_processes_outbox_successfully() {
        let outbox_store = Arc::new(InMemoryTupleSyncOutboxStore::new(vec![TupleSyncOutboxEvent {
            id: 1,
            event_type: AUTHZ_TUPLE_EVENT_GUILD_MEMBER_ROLE.to_owned(),
            aggregate_id: "guild:10/user:20/role:member".to_owned(),
            payload: json!({
                "op": "upsert",
                "guild_id": 10,
                "user_id": 20,
                "role_key": "member"
            }),
        }]));
        let sink = Arc::new(InMemoryTupleMutationSink::default());
        let service = AuthzTupleSyncService::new(
            Arc::clone(&outbox_store) as Arc<dyn TupleSyncOutboxStore>,
            Arc::new(StaticTupleBackfillSource::default()),
            Arc::clone(&sink) as Arc<dyn TupleMutationSink>,
            Arc::new(AuthzTupleSyncMetrics::default()),
            SpiceDbTupleSyncRuntimeConfig::default(),
        );

        let report = service.run_sync_once().await.unwrap();
        assert_eq!(report.claimed_events, 1);
        assert_eq!(report.succeeded_events, 1);
        assert_eq!(report.failed_events, 0);
        assert_eq!(report.applied_mutations, 2);
        assert_eq!(outbox_store.sent_ids().await, vec![1]);
        assert!(outbox_store.failed_entries().await.is_empty());

        let tuples = sink.snapshot().await;
        let compact: std::collections::BTreeSet<String> =
            tuples.iter().map(SpiceDbTuple::compact).collect();
        assert!(compact.contains("role:10/member#member@user:20"));

        let metrics = service.metrics().snapshot();
        assert_eq!(metrics.outbox_claimed_total, 1);
        assert_eq!(metrics.outbox_succeeded_total, 1);
        assert_eq!(metrics.outbox_failed_total, 0);
        assert_eq!(metrics.tuple_mutations_applied_total, 2);
    }

    #[tokio::test]
    async fn tuple_sync_service_marks_failed_when_sink_errors() {
        let outbox_store = Arc::new(InMemoryTupleSyncOutboxStore::new(vec![TupleSyncOutboxEvent {
            id: 2,
            event_type: AUTHZ_TUPLE_EVENT_GUILD_MEMBER_ROLE.to_owned(),
            aggregate_id: "guild:10/user:20/role:member".to_owned(),
            payload: json!({
                "op": "upsert",
                "guild_id": 10,
                "user_id": 20,
                "role_key": "member"
            }),
        }]));
        let sink = Arc::new(InMemoryTupleMutationSink::default());
        sink.set_failure_reason(Some("sink_down".to_owned())).await;

        let service = AuthzTupleSyncService::new(
            Arc::clone(&outbox_store) as Arc<dyn TupleSyncOutboxStore>,
            Arc::new(StaticTupleBackfillSource::default()),
            Arc::clone(&sink) as Arc<dyn TupleMutationSink>,
            Arc::new(AuthzTupleSyncMetrics::default()),
            SpiceDbTupleSyncRuntimeConfig::default(),
        );

        let report = service.run_sync_once().await.unwrap();
        assert_eq!(report.claimed_events, 1);
        assert_eq!(report.succeeded_events, 0);
        assert_eq!(report.failed_events, 1);
        assert!(outbox_store.sent_ids().await.is_empty());
        assert_eq!(
            outbox_store.failed_entries().await,
            vec![(2, SpiceDbTupleSyncRuntimeConfig::default().outbox_retry_seconds)]
        );

        let metrics = service.metrics().snapshot();
        assert_eq!(metrics.outbox_failed_total, 1);
        assert_eq!(metrics.sync_apply_failure_total, 1);
    }

    #[tokio::test]
    async fn tuple_sync_service_executes_full_resync_event() {
        let outbox_store = Arc::new(InMemoryTupleSyncOutboxStore::new(vec![TupleSyncOutboxEvent {
            id: 3,
            event_type: AUTHZ_TUPLE_EVENT_FULL_RESYNC.to_owned(),
            aggregate_id: "guild:all".to_owned(),
            payload: json!({
                "reason": "drift_detected"
            }),
        }]));
        let sink = Arc::new(InMemoryTupleMutationSink::default());
        sink.seed_tuples(vec![SpiceDbTuple::new(
            "guild:999",
            "viewer",
            "role:999/ghost#member",
        )])
        .await;
        let backfill_source = Arc::new(StaticTupleBackfillSource {
            guild_roles: vec![GuildRolePermissionRow {
                guild_id: 1,
                role_key: "member".to_owned(),
                allow_view: true,
                allow_post: false,
                allow_manage: false,
            }],
            guild_member_roles: vec![GuildMemberRoleRow {
                guild_id: 1,
                user_id: 88,
                role_key: "member".to_owned(),
            }],
            channel_role_overrides: Vec::new(),
            channel_user_overrides: vec![ChannelUserOverrideRow {
                channel_id: 55,
                guild_id: 1,
                user_id: 88,
                can_view: None,
                can_post: None,
            }],
        });

        let service = AuthzTupleSyncService::new(
            Arc::clone(&outbox_store) as Arc<dyn TupleSyncOutboxStore>,
            backfill_source as Arc<dyn TupleBackfillSource>,
            Arc::clone(&sink) as Arc<dyn TupleMutationSink>,
            Arc::new(AuthzTupleSyncMetrics::default()),
            SpiceDbTupleSyncRuntimeConfig::default(),
        );

        let report = service.run_sync_once().await.unwrap();
        assert_eq!(report.claimed_events, 1);
        assert_eq!(report.succeeded_events, 1);
        assert_eq!(report.failed_events, 0);
        assert_eq!(report.full_resync_events, 1);
        assert_eq!(outbox_store.sent_ids().await, vec![3]);

        let tuples = sink.snapshot().await;
        let compact: std::collections::BTreeSet<String> =
            tuples.iter().map(SpiceDbTuple::compact).collect();
        assert!(compact.contains("role:1/member#member@user:88"));
        assert!(compact.contains("guild:1#viewer@role:1/member#member"));
        assert!(compact.contains("channel:55#guild@guild:1"));
        assert!(!compact.contains("guild:999#viewer@role:999/ghost#member"));

        let metrics = service.metrics().snapshot();
        assert_eq!(metrics.outbox_full_resync_total, 1);
        assert_eq!(metrics.backfill_runs_total, 1);
        assert_eq!(metrics.backfill_generated_tuples_total, 3);
    }

    #[tokio::test]
    async fn tuple_sync_service_retries_when_mark_sent_fails() {
        let outbox_store = Arc::new(InMemoryTupleSyncOutboxStore::new(vec![TupleSyncOutboxEvent {
            id: 4,
            event_type: AUTHZ_TUPLE_EVENT_GUILD_MEMBER_ROLE.to_owned(),
            aggregate_id: "guild:10/user:20/role:member".to_owned(),
            payload: json!({
                "op": "upsert",
                "guild_id": 10,
                "user_id": 20,
                "role_key": "member"
            }),
        }]));
        outbox_store.fail_mark_sent_times(4, 1).await;

        let sink = Arc::new(InMemoryTupleMutationSink::default());
        let service = AuthzTupleSyncService::new(
            Arc::clone(&outbox_store) as Arc<dyn TupleSyncOutboxStore>,
            Arc::new(StaticTupleBackfillSource::default()),
            Arc::clone(&sink) as Arc<dyn TupleMutationSink>,
            Arc::new(AuthzTupleSyncMetrics::default()),
            SpiceDbTupleSyncRuntimeConfig::default(),
        );

        let first = service.run_sync_once().await.unwrap();
        assert_eq!(first.claimed_events, 1);
        assert_eq!(first.succeeded_events, 0);
        assert_eq!(first.failed_events, 1);
        assert_eq!(first.applied_mutations, 0);
        assert_eq!(
            outbox_store.failed_entries().await,
            vec![(4, SpiceDbTupleSyncRuntimeConfig::default().outbox_retry_seconds)]
        );
        assert!(outbox_store.sent_ids().await.is_empty());

        let second = service.run_sync_once().await.unwrap();
        assert_eq!(second.claimed_events, 1);
        assert_eq!(second.succeeded_events, 1);
        assert_eq!(second.failed_events, 0);
        assert_eq!(second.applied_mutations, 2);
        assert_eq!(outbox_store.sent_ids().await, vec![4]);

        let tuples = sink.snapshot().await;
        let compact: std::collections::BTreeSet<String> =
            tuples.iter().map(SpiceDbTuple::compact).collect();
        assert!(compact.contains("role:10/member#member@user:20"));
    }

    #[tokio::test]
    async fn tuple_sync_service_full_resync_does_not_delete_unmanaged_tuples() {
        let outbox_store = Arc::new(InMemoryTupleSyncOutboxStore::new(vec![TupleSyncOutboxEvent {
            id: 5,
            event_type: AUTHZ_TUPLE_EVENT_FULL_RESYNC.to_owned(),
            aggregate_id: "guild:all".to_owned(),
            payload: json!({
                "reason": "drift_detected"
            }),
        }]));
        let sink = Arc::new(InMemoryTupleMutationSink::default());
        sink.seed_tuples(vec![SpiceDbTuple::new(
            "api_path:/v1/protected/ping",
            "viewer",
            "user:1",
        )])
        .await;

        let service = AuthzTupleSyncService::new(
            Arc::clone(&outbox_store) as Arc<dyn TupleSyncOutboxStore>,
            Arc::new(StaticTupleBackfillSource::default()),
            Arc::clone(&sink) as Arc<dyn TupleMutationSink>,
            Arc::new(AuthzTupleSyncMetrics::default()),
            SpiceDbTupleSyncRuntimeConfig::default(),
        );

        let report = service.run_sync_once().await.unwrap();
        assert_eq!(report.claimed_events, 1);
        assert_eq!(report.succeeded_events, 1);
        assert_eq!(report.failed_events, 0);

        let tuples = sink.snapshot().await;
        let compact: std::collections::BTreeSet<String> =
            tuples.iter().map(SpiceDbTuple::compact).collect();
        assert!(compact.contains("api_path:/v1/protected/ping#viewer@user:1"));
    }

    #[tokio::test]
    async fn run_backfill_once_fails_when_sink_snapshot_is_unsupported() {
        let service = AuthzTupleSyncService::new(
            Arc::new(InMemoryTupleSyncOutboxStore::new(Vec::new())) as Arc<dyn TupleSyncOutboxStore>,
            Arc::new(StaticTupleBackfillSource::default()),
            Arc::new(SnapshotUnsupportedTupleSink) as Arc<dyn TupleMutationSink>,
            Arc::new(AuthzTupleSyncMetrics::default()),
            SpiceDbTupleSyncRuntimeConfig::default(),
        );

        let error = service.run_backfill_once().await.unwrap_err();
        assert!(error.contains("tuple_backfill_list_current_tuples_failed:tuple_snapshot_unsupported"));
    }

    #[tokio::test]
    async fn spicedb_tuple_sync_runtime_config_parses_env_values() {
        let _guard = env_lock().lock().await;
        let mut scoped = ScopedEnv::new();
        scoped.set("SPICEDB_TUPLE_SYNC_OUTBOX_CLAIM_LIMIT", "250");
        scoped.set("SPICEDB_TUPLE_SYNC_OUTBOX_LEASE_SECONDS", "45");
        scoped.set("SPICEDB_TUPLE_SYNC_OUTBOX_RETRY_SECONDS", "20");

        let config = build_spicedb_tuple_sync_runtime_config_from_env().unwrap();
        assert_eq!(config.outbox_claim_limit, 250);
        assert_eq!(config.outbox_lease_seconds, 45);
        assert_eq!(config.outbox_retry_seconds, 20);
    }

    #[tokio::test]
    async fn spicedb_tuple_sync_runtime_config_rejects_zero_values() {
        let _guard = env_lock().lock().await;
        let mut scoped = ScopedEnv::new();
        scoped.set("SPICEDB_TUPLE_SYNC_OUTBOX_CLAIM_LIMIT", "0");
        let claim_error = build_spicedb_tuple_sync_runtime_config_from_env().unwrap_err();
        assert!(claim_error.contains("SPICEDB_TUPLE_SYNC_OUTBOX_CLAIM_LIMIT"));
        assert!(claim_error.contains("greater than 0"));

        scoped.unset("SPICEDB_TUPLE_SYNC_OUTBOX_CLAIM_LIMIT");
        scoped.set("SPICEDB_TUPLE_SYNC_OUTBOX_LEASE_SECONDS", "0");
        let lease_error = build_spicedb_tuple_sync_runtime_config_from_env().unwrap_err();
        assert!(lease_error.contains("SPICEDB_TUPLE_SYNC_OUTBOX_LEASE_SECONDS"));
        assert!(lease_error.contains("greater than 0"));

        scoped.unset("SPICEDB_TUPLE_SYNC_OUTBOX_LEASE_SECONDS");
        scoped.set("SPICEDB_TUPLE_SYNC_OUTBOX_RETRY_SECONDS", "0");
        let retry_error = build_spicedb_tuple_sync_runtime_config_from_env().unwrap_err();
        assert!(retry_error.contains("SPICEDB_TUPLE_SYNC_OUTBOX_RETRY_SECONDS"));
        assert!(retry_error.contains("greater than 0"));
    }

    #[derive(Clone)]
    struct MockSpiceDbResponse {
        status_code: u16,
        body: serde_json::Value,
    }

    impl MockSpiceDbResponse {
        fn ok(permissionship: &str) -> Self {
            Self {
                status_code: 200,
                body: json!({
                    "permissionship": permissionship
                }),
            }
        }
    }

    #[derive(Clone)]
    struct MockSpiceDbState {
        responses: Arc<tokio::sync::Mutex<Vec<MockSpiceDbResponse>>>,
        request_count: Arc<AtomicU64>,
        requests: Arc<tokio::sync::Mutex<Vec<serde_json::Value>>>,
        require_auth: bool,
    }

    struct MockSpiceDbServer {
        address: std::net::SocketAddr,
        state: MockSpiceDbState,
    }

    impl MockSpiceDbServer {
        async fn start(responses: Vec<MockSpiceDbResponse>, require_auth: bool) -> Self {
            let state = MockSpiceDbState {
                responses: Arc::new(tokio::sync::Mutex::new(responses)),
                request_count: Arc::new(AtomicU64::new(0)),
                requests: Arc::new(tokio::sync::Mutex::new(Vec::new())),
                require_auth,
            };

            let app = Router::new()
                .route("/v1/permissions/check", post(mock_spicedb_check_handler))
                .with_state(state.clone());

            let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
            let address = listener.local_addr().unwrap();

            tokio::spawn(async move {
                let _ = axum::serve(listener, app).await;
            });

            Self { address, state }
        }

        fn endpoint(&self) -> String {
            format!("http://{}", self.address)
        }

        fn request_count(&self) -> u64 {
            self.state
                .request_count
                .load(Ordering::Relaxed)
        }

        async fn requests(&self) -> Vec<serde_json::Value> {
            self.state.requests.lock().await.clone()
        }
    }

    async fn mock_spicedb_check_handler(
        State(state): State<MockSpiceDbState>,
        headers: axum::http::HeaderMap,
        Json(request): Json<serde_json::Value>,
    ) -> (axum::http::StatusCode, Json<serde_json::Value>) {
        state
            .request_count
            .fetch_add(1, Ordering::Relaxed);
        state.requests.lock().await.push(request);

        if state.require_auth {
            let has_header = headers
                .get("authorization")
                .and_then(|value| value.to_str().ok())
                .map(|value| value.starts_with("Bearer "))
                .unwrap_or(false);
            if !has_header {
                return (
                    axum::http::StatusCode::UNAUTHORIZED,
                    Json(json!({"message":"missing auth header"})),
                );
            }
        }

        let mut responses = state.responses.lock().await;
        let response = if responses.is_empty() {
            MockSpiceDbResponse::ok("PERMISSIONSHIP_NO_PERMISSION")
        } else {
            responses.remove(0)
        };

        (
            axum::http::StatusCode::from_u16(response.status_code).unwrap(),
            Json(response.body),
        )
    }

    #[derive(Default)]
    struct StaticTupleBackfillSource {
        guild_roles: Vec<GuildRolePermissionRow>,
        guild_member_roles: Vec<GuildMemberRoleRow>,
        channel_role_overrides: Vec<ChannelRoleOverrideRow>,
        channel_user_overrides: Vec<ChannelUserOverrideRow>,
    }

    #[async_trait]
    impl TupleBackfillSource for StaticTupleBackfillSource {
        async fn list_guild_roles(&self) -> Result<Vec<GuildRolePermissionRow>, String> {
            Ok(self.guild_roles.clone())
        }

        async fn list_guild_member_roles(&self) -> Result<Vec<GuildMemberRoleRow>, String> {
            Ok(self.guild_member_roles.clone())
        }

        async fn list_channel_role_overrides(&self) -> Result<Vec<ChannelRoleOverrideRow>, String> {
            Ok(self.channel_role_overrides.clone())
        }

        async fn list_channel_user_overrides(&self) -> Result<Vec<ChannelUserOverrideRow>, String> {
            Ok(self.channel_user_overrides.clone())
        }
    }

    struct InMemoryTupleSyncOutboxStore {
        events: tokio::sync::Mutex<Vec<TupleSyncOutboxEvent>>,
        claimed_events: tokio::sync::Mutex<std::collections::BTreeMap<i64, TupleSyncOutboxEvent>>,
        sent_ids: tokio::sync::Mutex<Vec<i64>>,
        failed_entries: tokio::sync::Mutex<Vec<(i64, u32)>>,
        mark_sent_failures_remaining: tokio::sync::Mutex<std::collections::BTreeMap<i64, u32>>,
    }

    impl InMemoryTupleSyncOutboxStore {
        fn new(events: Vec<TupleSyncOutboxEvent>) -> Self {
            Self {
                events: tokio::sync::Mutex::new(events),
                claimed_events: tokio::sync::Mutex::new(std::collections::BTreeMap::new()),
                sent_ids: tokio::sync::Mutex::new(Vec::new()),
                failed_entries: tokio::sync::Mutex::new(Vec::new()),
                mark_sent_failures_remaining: tokio::sync::Mutex::new(std::collections::BTreeMap::new()),
            }
        }

        async fn sent_ids(&self) -> Vec<i64> {
            self.sent_ids.lock().await.clone()
        }

        async fn failed_entries(&self) -> Vec<(i64, u32)> {
            self.failed_entries.lock().await.clone()
        }

        async fn fail_mark_sent_times(&self, event_id: i64, times: u32) {
            self.mark_sent_failures_remaining
                .lock()
                .await
                .insert(event_id, times);
        }
    }

    #[async_trait]
    impl TupleSyncOutboxStore for InMemoryTupleSyncOutboxStore {
        async fn claim_outbox_events(
            &self,
            limit: u32,
            _lease_seconds: u32,
        ) -> Result<Vec<TupleSyncOutboxEvent>, String> {
            let mut events = self.events.lock().await;
            let take = usize::min(events.len(), limit as usize);
            let claimed: Vec<TupleSyncOutboxEvent> = events.drain(..take).collect();
            drop(events);

            let mut in_flight = self.claimed_events.lock().await;
            for event in &claimed {
                in_flight.insert(event.id, event.clone());
            }

            Ok(claimed)
        }

        async fn mark_outbox_event_sent(&self, event_id: i64) -> Result<(), String> {
            let mut failure = self.mark_sent_failures_remaining.lock().await;
            if let Some(remaining) = failure.get_mut(&event_id) {
                if *remaining > 0 {
                    *remaining -= 1;
                    return Err("injected_mark_sent_failure".to_owned());
                }
            }
            drop(failure);

            self.claimed_events.lock().await.remove(&event_id);
            self.sent_ids.lock().await.push(event_id);
            Ok(())
        }

        async fn mark_outbox_event_failed(
            &self,
            event_id: i64,
            retry_seconds: u32,
        ) -> Result<(), String> {
            self.failed_entries
                .lock()
                .await
                .push((event_id, retry_seconds));
            let claimed = self.claimed_events.lock().await.remove(&event_id);
            if let Some(event) = claimed {
                self.events.lock().await.push(event);
            }
            Ok(())
        }
    }

    #[derive(Default)]
    struct SnapshotUnsupportedTupleSink;

    #[async_trait]
    impl TupleMutationSink for SnapshotUnsupportedTupleSink {
        async fn apply_mutations(
            &self,
            _mutations: Vec<SpiceDbTupleMutation>,
        ) -> Result<(), String> {
            Ok(())
        }

        async fn list_current_tuples(&self) -> Result<Vec<SpiceDbTuple>, String> {
            Err("tuple_snapshot_unsupported".to_owned())
        }
    }
}
