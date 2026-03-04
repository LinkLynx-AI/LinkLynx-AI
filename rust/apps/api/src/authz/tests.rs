#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
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
            channel_user_overrides: Vec::new(),
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

        let metrics = service.metrics().snapshot();
        assert_eq!(metrics.outbox_full_resync_total, 1);
        assert_eq!(metrics.backfill_runs_total, 1);
        assert_eq!(metrics.backfill_generated_tuples_total, 2);
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
        sent_ids: tokio::sync::Mutex<Vec<i64>>,
        failed_entries: tokio::sync::Mutex<Vec<(i64, u32)>>,
    }

    impl InMemoryTupleSyncOutboxStore {
        fn new(events: Vec<TupleSyncOutboxEvent>) -> Self {
            Self {
                events: tokio::sync::Mutex::new(events),
                sent_ids: tokio::sync::Mutex::new(Vec::new()),
                failed_entries: tokio::sync::Mutex::new(Vec::new()),
            }
        }

        async fn sent_ids(&self) -> Vec<i64> {
            self.sent_ids.lock().await.clone()
        }

        async fn failed_entries(&self) -> Vec<(i64, u32)> {
            self.failed_entries.lock().await.clone()
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
            Ok(events.drain(..take).collect())
        }

        async fn mark_outbox_event_sent(&self, event_id: i64) -> Result<(), String> {
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
            Ok(())
        }
    }
}
