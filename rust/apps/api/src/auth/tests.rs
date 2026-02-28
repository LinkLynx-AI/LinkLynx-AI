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

        fn remove(&mut self, name: &str) {
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

    struct StaticTokenVerifier;

    #[async_trait]
    impl TokenVerifier for StaticTokenVerifier {
        async fn verify(&self, token: &str) -> Result<VerifiedToken, TokenVerifyError> {
            let Some((uid, exp)) = token.split_once(':') else {
                return Err(TokenVerifyError::Invalid("token_format_invalid"));
            };

            let expires_at_epoch = exp
                .parse::<u64>()
                .map_err(|_| TokenVerifyError::Invalid("token_exp_invalid"))?;

            if expires_at_epoch <= unix_timestamp_seconds() {
                return Err(TokenVerifyError::Expired);
            }

            Ok(VerifiedToken {
                uid: uid.to_owned(),
                email: Some(format!("{uid}@example.com")),
                email_verified: true,
                display_name: Some(uid.to_owned()),
                expires_at_epoch,
            })
        }
    }

    #[tokio::test]
    async fn auth_service_resolves_principal() {
        let metrics = Arc::new(AuthMetrics::default());
        let verifier: Arc<dyn TokenVerifier> = Arc::new(StaticTokenVerifier);
        let store = Arc::new(InMemoryPrincipalStore::default());
        store
            .insert(FIREBASE_PROVIDER, "u-1", PrincipalId(42))
            .await;
        let store_resolver: Arc<dyn PrincipalStore> = store.clone();
        let provisioner: Arc<dyn PrincipalProvisioner> = store.clone();

        let resolver: Arc<dyn PrincipalResolver> = Arc::new(CachingPrincipalResolver::new(
            FIREBASE_PROVIDER.to_owned(),
            Arc::new(InMemoryPrincipalCache::default()),
            store_resolver,
            provisioner,
            Duration::from_secs(30),
            Arc::clone(&metrics),
        ));

        let service = AuthService::new(verifier, resolver, metrics);
        let token = format!("u-1:{}", unix_timestamp_seconds() + 60);

        let authenticated = service.authenticate_token(&token).await.unwrap();
        assert_eq!(authenticated.principal_id.0, 42);
        assert_eq!(authenticated.firebase_uid, "u-1");
    }

    #[test]
    fn bearer_header_parser_requires_bearer_scheme() {
        let mut headers = HeaderMap::new();
        headers.insert(AUTHORIZATION, "Basic x".parse().unwrap());

        let error = bearer_token_from_headers(&headers).unwrap_err();
        assert_eq!(error.kind, AuthErrorKind::InvalidToken);
    }

    #[test]
    fn request_id_prefers_header_value() {
        let mut headers = HeaderMap::new();
        headers.insert("x-request-id", "req-1".parse().unwrap());

        assert_eq!(request_id_from_headers(&headers), "req-1");
    }

    #[test]
    fn auth_error_decision_maps_unavailable_separately() {
        assert_eq!(AuthError::invalid_token("bad").decision(), "deny");
        assert_eq!(
            AuthError::dependency_unavailable("downstream_down").decision(),
            "unavailable"
        );
    }

    #[test]
    fn auth_error_email_not_verified_maps_to_forbidden() {
        let error = AuthError::email_not_verified("firebase_email_not_verified");
        assert_eq!(error.status_code(), axum::http::StatusCode::FORBIDDEN);
        assert_eq!(error.app_code(), "AUTH_EMAIL_NOT_VERIFIED");
        assert_eq!(error.ws_close_code(), 1008);
    }

    #[tokio::test]
    async fn jwks_cache_respects_missing_kid_refresh_backoff() {
        let client = Client::builder()
            .timeout(Duration::from_millis(50))
            .build()
            .unwrap();
        let cache = JwksCache::new(
            client,
            "http://127.0.0.1:9/jwks".to_owned(),
            Duration::from_secs(300),
        );

        {
            let mut state = cache.state.write().await;
            state.fetched_at = Some(Instant::now());
            state
                .missing_kid_refresh_at
                .insert("unknown".to_owned(), Instant::now());
            state.keys.insert(
                "known".to_owned(),
                JwkRsaKey {
                    kid: "known".to_owned(),
                    kty: "RSA".to_owned(),
                    n: "AQAB".to_owned(),
                    e: "AQAB".to_owned(),
                },
            );
        }

        let result = cache.key_for("unknown").await;
        assert!(matches!(
            result,
            Err(TokenVerifyError::Invalid("jwks_kid_not_found"))
        ));
    }

    #[tokio::test]
    async fn jwks_cache_backoff_is_tracked_per_kid() {
        let client = Client::builder()
            .timeout(Duration::from_millis(50))
            .build()
            .unwrap();
        let cache = JwksCache::new(
            client,
            "http://127.0.0.1:9/jwks".to_owned(),
            Duration::from_secs(300),
        );

        {
            let mut state = cache.state.write().await;
            state.fetched_at = Some(Instant::now());
            state
                .missing_kid_refresh_at
                .insert("unknown-a".to_owned(), Instant::now());
            state.keys.insert(
                "known".to_owned(),
                JwkRsaKey {
                    kid: "known".to_owned(),
                    kty: "RSA".to_owned(),
                    n: "AQAB".to_owned(),
                    e: "AQAB".to_owned(),
                },
            );
        }

        let result_a = cache.key_for("unknown-a").await;
        assert!(matches!(
            result_a,
            Err(TokenVerifyError::Invalid("jwks_kid_not_found"))
        ));

        let result_b = cache.key_for("unknown-b").await;
        assert!(matches!(
            result_b,
            Err(TokenVerifyError::DependencyUnavailable(_))
        ));
    }

    #[tokio::test]
    async fn jwks_cache_global_backoff_limits_distinct_kid_refresh_bursts() {
        let client = Client::builder()
            .timeout(Duration::from_millis(50))
            .build()
            .unwrap();
        let cache = JwksCache::new(
            client,
            "http://127.0.0.1:9/jwks".to_owned(),
            Duration::from_secs(300),
        );

        {
            let mut state = cache.state.write().await;
            state.fetched_at = Some(Instant::now());
            state.missing_kid_refresh_at.clear();
            state.keys.insert(
                "known".to_owned(),
                JwkRsaKey {
                    kid: "known".to_owned(),
                    kty: "RSA".to_owned(),
                    n: "AQAB".to_owned(),
                    e: "AQAB".to_owned(),
                },
            );
        }

        let first = cache.key_for("unknown-a").await;
        assert!(matches!(
            first,
            Err(TokenVerifyError::DependencyUnavailable(_))
        ));

        let second = cache.key_for("unknown-b").await;
        assert!(matches!(
            second,
            Err(TokenVerifyError::DependencyUnavailable(_))
        ));
    }

    #[tokio::test]
    async fn jwks_cache_triggers_refresh_on_fresh_kid_miss_when_backoff_allows() {
        let client = Client::builder()
            .timeout(Duration::from_millis(50))
            .build()
            .unwrap();
        let cache = JwksCache::new(
            client,
            "http://127.0.0.1:9/jwks".to_owned(),
            Duration::from_secs(300),
        );

        {
            let mut state = cache.state.write().await;
            state.fetched_at = Some(Instant::now());
            state.missing_kid_refresh_at.clear();
            state.keys.insert(
                "known".to_owned(),
                JwkRsaKey {
                    kid: "known".to_owned(),
                    kty: "RSA".to_owned(),
                    n: "AQAB".to_owned(),
                    e: "AQAB".to_owned(),
                },
            );
        }

        let result = cache.key_for("unknown").await;
        assert!(matches!(
            result,
            Err(TokenVerifyError::DependencyUnavailable(_))
        ));
    }

    #[tokio::test]
    async fn jwks_cache_keeps_unavailable_class_during_backoff() {
        let client = Client::builder()
            .timeout(Duration::from_millis(50))
            .build()
            .unwrap();
        let cache = JwksCache::new(
            client,
            "http://127.0.0.1:9/jwks".to_owned(),
            Duration::from_secs(300),
        );

        {
            let mut state = cache.state.write().await;
            state.fetched_at = Some(Instant::now());
            state.missing_kid_refresh_at.clear();
            state.keys.insert(
                "known".to_owned(),
                JwkRsaKey {
                    kid: "known".to_owned(),
                    kty: "RSA".to_owned(),
                    n: "AQAB".to_owned(),
                    e: "AQAB".to_owned(),
                },
            );
        }

        let first = cache.key_for("unknown").await;
        assert!(matches!(
            first,
            Err(TokenVerifyError::DependencyUnavailable(_))
        ));

        let second = cache.key_for("unknown").await;
        assert!(matches!(
            second,
            Err(TokenVerifyError::DependencyUnavailable(_))
        ));
    }

    #[tokio::test]
    async fn jwks_cache_stale_path_fails_fast_after_recent_unavailable() {
        let client = Client::builder()
            .timeout(Duration::from_millis(50))
            .build()
            .unwrap();
        let cache = JwksCache::new(
            client,
            "http://127.0.0.1:9/jwks".to_owned(),
            Duration::from_millis(10),
        );

        {
            let mut state = cache.state.write().await;
            state.fetched_at = Some(Instant::now() - Duration::from_secs(1));
            state.last_refresh_unavailable_at = Some(Instant::now());
        }

        let result = cache.key_for("unknown").await;
        assert!(matches!(
            result,
            Err(TokenVerifyError::DependencyUnavailable(_))
        ));
    }

    #[tokio::test]
    async fn in_memory_principal_cache_removes_expired_entries() {
        let cache = InMemoryPrincipalCache::default();
        cache
            .set(
                FIREBASE_PROVIDER,
                "u-expired",
                PrincipalId(99),
                Duration::from_millis(5),
            )
            .await
            .unwrap();

        tokio::time::sleep(Duration::from_millis(10)).await;

        let result = cache.get(FIREBASE_PROVIDER, "u-expired").await.unwrap();
        assert_eq!(result, None);

        let entries = cache.entries.read().await;
        assert!(entries.is_empty());
    }

    #[tokio::test]
    async fn runtime_principal_store_fail_closes_without_database_url() {
        let _lock = env_lock().lock().await;
        let mut scoped = ScopedEnv::new();
        scoped.remove("DATABASE_URL");

        let metrics = Arc::new(AuthMetrics::default());
        let (store, provisioner) = build_runtime_principal_dependencies(metrics);
        let error = store
            .find_principal_id(FIREBASE_PROVIDER, "u-1")
            .await
            .unwrap_err();
        let provision_error = provisioner
            .provision_principal_id(
                FIREBASE_PROVIDER,
                &VerifiedToken {
                    uid: "u-1".to_owned(),
                    email: Some("u-1@example.com".to_owned()),
                    email_verified: true,
                    display_name: None,
                    expires_at_epoch: unix_timestamp_seconds() + 60,
                },
            )
            .await
            .unwrap_err();

        assert_eq!(error, "principal_store_unconfigured");
        assert!(matches!(
            provision_error,
            PrincipalProvisionError::DependencyUnavailable(_)
        ));
    }

    #[tokio::test]
    async fn in_memory_provisioner_creates_mapping_idempotently() {
        let store = InMemoryPrincipalStore::default();
        let verified = VerifiedToken {
            uid: "u-new".to_owned(),
            email: Some("new@example.com".to_owned()),
            email_verified: true,
            display_name: Some("New User".to_owned()),
            expires_at_epoch: unix_timestamp_seconds() + 60,
        };

        let first = store
            .provision_principal_id(FIREBASE_PROVIDER, &verified)
            .await
            .unwrap();
        let second = store
            .provision_principal_id(FIREBASE_PROVIDER, &verified)
            .await
            .unwrap();

        assert_eq!(first, second);
    }

    #[tokio::test]
    async fn firebase_config_reads_iat_skew_from_env() {
        let _lock = env_lock().lock().await;
        let mut scoped = ScopedEnv::new();
        scoped.set("FIREBASE_PROJECT_ID", "test-project");
        scoped.set("FIREBASE_IAT_SKEW_SECONDS", "120");

        let config = FirebaseAuthConfig::from_env().unwrap();
        assert_eq!(config.iat_skew_seconds, 120);
    }

    #[tokio::test]
    async fn parse_env_helpers_fallback_on_invalid_values() {
        let _lock = env_lock().lock().await;
        let mut scoped = ScopedEnv::new();
        scoped.set("AUTH_PRINCIPAL_STORE_POOL_SIZE", "invalid");
        scoped.set("AUTH_ALLOW_POSTGRES_NOTLS", "invalid");

        assert_eq!(parse_env_u64("AUTH_PRINCIPAL_STORE_POOL_SIZE", 4), 4);
        assert!(!parse_env_bool("AUTH_ALLOW_POSTGRES_NOTLS", false));
    }

    #[tokio::test]
    async fn postgres_principal_store_requires_tls_by_default() {
        let _lock = env_lock().lock().await;
        let mut scoped = ScopedEnv::new();
        scoped.remove("AUTH_ALLOW_POSTGRES_NOTLS");

        let store = PostgresPrincipalStore::new(
            "postgres://localhost/test".to_owned(),
            Arc::new(AuthMetrics::default()),
        );
        let error = store.connect_client().await.unwrap_err();
        assert!(error.starts_with("postgres_tls_required"));
    }

    #[tokio::test]
    async fn postgres_principal_store_uses_notls_when_opted_in() {
        let _lock = env_lock().lock().await;
        let mut scoped = ScopedEnv::new();
        scoped.set("AUTH_ALLOW_POSTGRES_NOTLS", "true");

        let store = PostgresPrincipalStore::new(
            "postgres://127.0.0.1:9/test".to_owned(),
            Arc::new(AuthMetrics::default()),
        );
        let error = store.connect_client().await.unwrap_err();
        assert!(error.starts_with("postgres_connect_notls_failed:"));
    }

    #[tokio::test]
    async fn postgres_principal_store_retry_delay_uses_exponential_backoff() {
        let _lock = env_lock().lock().await;
        let mut scoped = ScopedEnv::new();
        scoped.set("AUTH_PRINCIPAL_STORE_RETRY_BASE_BACKOFF_MS", "10");

        let store = PostgresPrincipalStore::new(
            "postgres://localhost/test".to_owned(),
            Arc::new(AuthMetrics::default()),
        );
        assert_eq!(store.retry_delay(0), Duration::from_millis(10));
        assert_eq!(store.retry_delay(1), Duration::from_millis(20));
        assert_eq!(store.retry_delay(2), Duration::from_millis(40));
    }
}
