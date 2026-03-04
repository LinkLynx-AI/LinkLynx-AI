#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;
    use std::collections::HashSet;
    use auth::{
        CachingPrincipalResolver, InMemoryPrincipalCache, InMemoryPrincipalStore,
        PrincipalProvisioner, PrincipalResolver, PrincipalStore, TokenVerifier, TokenVerifyError,
        VerifiedToken,
    };
    use authz::{Authorizer, AuthzAction, AuthzCheckInput, AuthzError, AuthzResource};
    use guild_channel::{
        ChannelSummary, CreatedChannel, CreatedGuild, GuildChannelError, GuildChannelService,
        GuildSummary,
    };
    use profile::{ProfileError, ProfilePatchInput, ProfileService, ProfileSettings};
    use axum::{body::to_bytes, http::StatusCode};
    use linklynx_shared::PrincipalId;
    use tower::ServiceExt;

    const MAX_RESPONSE_BYTES: usize = 16 * 1024;

    struct StaticTokenVerifier;
    struct StaticAllowAllAuthorizer;
    struct StaticDenyAuthorizer;
    struct StaticUnavailableAuthorizer;
    struct StaticGuildChannelService;
    struct StaticProfileService;
    struct StaticUnavailableProfileService;
    struct RoleScenarioAuthorizer;

    #[async_trait]
    impl TokenVerifier for StaticTokenVerifier {
        async fn verify(&self, token: &str) -> Result<VerifiedToken, TokenVerifyError> {
            let Some((uid, exp)) = token.split_once(':') else {
                return Err(TokenVerifyError::Invalid("token_format_invalid"));
            };

            let exp = exp
                .parse::<u64>()
                .map_err(|_| TokenVerifyError::Invalid("token_exp_invalid"))?;

            if exp <= unix_timestamp_seconds() {
                return Err(TokenVerifyError::Expired);
            }

            Ok(VerifiedToken {
                uid: uid.to_owned(),
                email: Some(format!("{uid}@example.com")),
                email_verified: true,
                display_name: Some(uid.to_owned()),
                expires_at_epoch: exp,
            })
        }
    }

    #[async_trait]
    impl Authorizer for StaticAllowAllAuthorizer {
        async fn check(&self, _input: &AuthzCheckInput) -> Result<(), AuthzError> {
            Ok(())
        }
    }

    #[async_trait]
    impl Authorizer for StaticDenyAuthorizer {
        async fn check(&self, _input: &AuthzCheckInput) -> Result<(), AuthzError> {
            Err(AuthzError::denied("test_authz_denied"))
        }
    }

    #[async_trait]
    impl Authorizer for StaticUnavailableAuthorizer {
        async fn check(&self, _input: &AuthzCheckInput) -> Result<(), AuthzError> {
            Err(AuthzError::unavailable("test_authz_unavailable"))
        }
    }

    #[async_trait]
    impl Authorizer for RoleScenarioAuthorizer {
        async fn check(&self, input: &AuthzCheckInput) -> Result<(), AuthzError> {
            match (&input.resource, input.action) {
                (AuthzResource::Guild { .. }, AuthzAction::Manage) => {
                    if input.principal_id.0 == 9001 || input.principal_id.0 == 9002 {
                        Ok(())
                    } else {
                        Err(AuthzError::denied("guild_manage_denied"))
                    }
                }
                (AuthzResource::Guild { .. }, AuthzAction::View) => {
                    if input.principal_id.0 == 9001
                        || input.principal_id.0 == 9002
                        || input.principal_id.0 == 9003
                    {
                        Ok(())
                    } else {
                        Err(AuthzError::denied("guild_view_denied"))
                    }
                }
                (AuthzResource::GuildChannel { .. }, AuthzAction::View | AuthzAction::Post) => {
                    if input.principal_id.0 == 9001
                        || input.principal_id.0 == 9002
                        || input.principal_id.0 == 9003
                    {
                        Ok(())
                    } else {
                        Err(AuthzError::denied("guild_channel_access_denied"))
                    }
                }
                (AuthzResource::Channel { .. }, AuthzAction::View | AuthzAction::Post) => {
                    if input.principal_id.0 == 9001
                        || input.principal_id.0 == 9002
                        || input.principal_id.0 == 9003
                    {
                        Ok(())
                    } else {
                        Err(AuthzError::denied("dm_channel_access_denied"))
                    }
                }
                _ => Err(AuthzError::denied("unsupported_role_scenario")),
            }
        }
    }

    #[async_trait]
    impl GuildChannelService for StaticGuildChannelService {
        async fn list_guilds(
            &self,
            principal_id: PrincipalId,
        ) -> Result<Vec<GuildSummary>, GuildChannelError> {
            if principal_id.0 != 1001 {
                return Ok(vec![]);
            }

            Ok(vec![GuildSummary {
                guild_id: 2001,
                name: "LinkLynx Developers".to_owned(),
                icon_key: None,
                joined_at: "2026-03-03T00:00:00Z".to_owned(),
            }])
        }

        async fn create_guild(
            &self,
            principal_id: PrincipalId,
            name: String,
        ) -> Result<CreatedGuild, GuildChannelError> {
            let normalized = name.trim();
            if normalized.is_empty() {
                return Err(GuildChannelError::validation("guild_name_required"));
            }

            Ok(CreatedGuild {
                guild_id: 2002,
                name: normalized.to_owned(),
                icon_key: None,
                owner_id: principal_id.0,
            })
        }

        async fn list_guild_channels(
            &self,
            principal_id: PrincipalId,
            guild_id: i64,
        ) -> Result<Vec<ChannelSummary>, GuildChannelError> {
            if guild_id != 2001 {
                return Err(GuildChannelError::not_found("guild_not_found"));
            }
            if principal_id.0 != 1001 {
                return Err(GuildChannelError::forbidden("guild_membership_required"));
            }

            Ok(vec![
                ChannelSummary {
                    channel_id: 3001,
                    guild_id,
                    name: "general".to_owned(),
                    created_at: "2026-03-03T00:00:00Z".to_owned(),
                },
                ChannelSummary {
                    channel_id: 3002,
                    guild_id,
                    name: "random".to_owned(),
                    created_at: "2026-03-03T00:00:30Z".to_owned(),
                },
            ])
        }

        async fn create_guild_channel(
            &self,
            principal_id: PrincipalId,
            guild_id: i64,
            name: String,
        ) -> Result<CreatedChannel, GuildChannelError> {
            if guild_id != 2001 {
                return Err(GuildChannelError::not_found("guild_not_found"));
            }
            if principal_id.0 != 1001 {
                return Err(GuildChannelError::forbidden("guild_membership_required"));
            }

            let normalized = name.trim();
            if normalized.is_empty() {
                return Err(GuildChannelError::validation("channel_name_required"));
            }

            Ok(CreatedChannel {
                channel_id: 3003,
                guild_id,
                name: normalized.to_owned(),
                created_at: "2026-03-03T00:01:00Z".to_owned(),
            })
        }
    }

    #[async_trait]
    impl ProfileService for StaticProfileService {
        async fn get_profile(&self, principal_id: PrincipalId) -> Result<ProfileSettings, ProfileError> {
            if principal_id.0 != 1001 {
                return Err(ProfileError::not_found("user_not_found"));
            }

            Ok(ProfileSettings {
                display_name: "Alice".to_owned(),
                status_text: Some("Ready".to_owned()),
                avatar_key: Some("avatars/alice.png".to_owned()),
            })
        }

        async fn update_profile(
            &self,
            principal_id: PrincipalId,
            patch: ProfilePatchInput,
        ) -> Result<ProfileSettings, ProfileError> {
            if principal_id.0 != 1001 {
                return Err(ProfileError::not_found("user_not_found"));
            }

            if patch.is_empty() {
                return Err(ProfileError::validation("profile_patch_empty"));
            }

            let mut profile = ProfileSettings {
                display_name: "Alice".to_owned(),
                status_text: Some("Ready".to_owned()),
                avatar_key: Some("avatars/alice.png".to_owned()),
            };

            if let Some(display_name) = patch.display_name {
                let normalized = display_name.trim();
                if normalized.is_empty() || normalized.chars().count() > 32 {
                    return Err(ProfileError::validation("display_name_invalid"));
                }
                profile.display_name = normalized.to_owned();
            }

            if let Some(status_text) = patch.status_text {
                profile.status_text = status_text.and_then(|value| {
                    let trimmed = value.trim().to_owned();
                    if trimmed.is_empty() {
                        None
                    } else {
                        Some(trimmed)
                    }
                });
            }

            if let Some(avatar_key) = patch.avatar_key {
                let normalized = avatar_key.and_then(|value| {
                    let trimmed = value.trim().to_owned();
                    if trimmed.is_empty() {
                        None
                    } else {
                        Some(trimmed)
                    }
                });

                if let Some(value) = &normalized {
                    let valid_format = value.bytes().all(|byte| {
                        byte.is_ascii_alphanumeric() || matches!(byte, b'/' | b'_' | b'-' | b'.')
                    });
                    if !valid_format {
                        return Err(ProfileError::validation("avatar_key_invalid_format"));
                    }
                }

                profile.avatar_key = normalized;
            }

            Ok(profile)
        }
    }

    #[async_trait]
    impl ProfileService for StaticUnavailableProfileService {
        async fn get_profile(
            &self,
            _principal_id: PrincipalId,
        ) -> Result<ProfileSettings, ProfileError> {
            Err(ProfileError::dependency_unavailable(
                "profile_store_temporarily_unavailable",
            ))
        }

        async fn update_profile(
            &self,
            _principal_id: PrincipalId,
            _patch: ProfilePatchInput,
        ) -> Result<ProfileSettings, ProfileError> {
            Err(ProfileError::dependency_unavailable(
                "profile_store_temporarily_unavailable",
            ))
        }
    }

    async fn app_for_test() -> Router {
        app_for_test_with_authorizer_and_profile(
            Arc::new(StaticAllowAllAuthorizer),
            Arc::new(StaticProfileService),
        )
        .await
    }

    async fn app_for_test_with_authorizer(authorizer: Arc<dyn Authorizer>) -> Router {
        app_for_test_with_authorizer_and_profile(authorizer, Arc::new(StaticProfileService)).await
    }

    async fn app_for_test_with_authorizer_and_profile(
        authorizer: Arc<dyn Authorizer>,
        profile_service: Arc<dyn ProfileService>,
    ) -> Router {
        let metrics = Arc::new(AuthMetrics::default());
        let verifier: Arc<dyn TokenVerifier> = Arc::new(StaticTokenVerifier);

        let store = Arc::new(InMemoryPrincipalStore::default());
        store.insert("firebase", "u-1", PrincipalId(1001)).await;
        let store_resolver: Arc<dyn PrincipalStore> = store.clone();
        let provisioner: Arc<dyn PrincipalProvisioner> = store.clone();

        let resolver: Arc<dyn PrincipalResolver> = Arc::new(CachingPrincipalResolver::new(
            "firebase".to_owned(),
            Arc::new(InMemoryPrincipalCache::default()),
            store_resolver,
            provisioner,
            Duration::from_secs(120),
            Arc::clone(&metrics),
        ));

        let auth_service = Arc::new(AuthService::new(verifier, resolver, metrics));
        let state = AppState {
            auth_service,
            authorizer,
            authz_metrics: Arc::new(AuthzMetrics::default()),
            guild_channel_service: Arc::new(StaticGuildChannelService),
            profile_service,
            ws_reauth_grace: Duration::from_secs(30),
            ws_ticket_ttl: Duration::from_secs(60),
            auth_identify_timeout: Duration::from_secs(5),
            ws_ticket_store: Arc::new(WsTicketStore::default()),
            ws_ticket_rate_limiter: Arc::new(FixedWindowRateLimiter::new(
                20,
                Duration::from_secs(60),
            )),
            ws_identify_rate_limiter: Arc::new(FixedWindowRateLimiter::new(
                60,
                Duration::from_secs(60),
            )),
            ws_origin_allowlist: Arc::new(WsOriginAllowlist::new(HashSet::from([
                "http://localhost:3000".to_owned(),
                "http://127.0.0.1:3000".to_owned(),
            ]))),
        };

        app_with_state(state)
    }

    async fn parse_principal_id_from_response(response: Response) -> i64 {
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        json["principal_id"].as_i64().unwrap()
    }

    #[tokio::test]
    async fn root_returns_server_name() {
        let app = app_for_test().await;
        let response = app
            .oneshot(Request::builder().uri("/").body(Body::empty()).unwrap())
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        assert_eq!(body.as_ref(), b"LinkLynx API Server");
    }

    #[tokio::test]
    async fn health_returns_ok() {
        let app = app_for_test().await;
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/health")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        assert_eq!(body.as_ref(), b"OK");
    }

    #[tokio::test]
    async fn protected_endpoint_rejects_missing_token() {
        let app = app_for_test().await;
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/protected/ping")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn auth_metrics_endpoint_rejects_missing_token() {
        let app = app_for_test().await;
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/internal/auth/metrics")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn auth_metrics_endpoint_rejects_invalid_token() {
        let app = app_for_test().await;
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/internal/auth/metrics")
                    .header("authorization", "Bearer invalid-token")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn auth_metrics_endpoint_rejects_expired_token() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds().saturating_sub(1));
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/internal/auth/metrics")
                    .header("authorization", format!("Bearer {token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn auth_metrics_endpoint_accepts_valid_token() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/internal/auth/metrics")
                    .header("authorization", format!("Bearer {token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert!(json.get("token_verify_success_total").is_some());
        assert!(json.get("principal_cache_hit_ratio").is_some());
    }

    #[tokio::test]
    async fn protected_endpoint_accepts_valid_token() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/protected/ping")
                    .header("authorization", format!("Bearer {token}"))
                    .header("x-request-id", "test-req-id")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();

        assert_eq!(json["ok"], true);
        assert_eq!(json["request_id"], "test-req-id");
        assert_eq!(json["principal_id"], 1001);
        assert_eq!(json["firebase_uid"], "u-1");
    }

    #[tokio::test]
    async fn protected_endpoint_provisions_missing_mapping() {
        let app = app_for_test().await;
        let token = format!("u-unknown:{}", unix_timestamp_seconds() + 300);
        let first_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/protected/ping")
                    .header("authorization", format!("Bearer {token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(first_response.status(), StatusCode::OK);
        let first_principal_id = parse_principal_id_from_response(first_response).await;

        let second_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/protected/ping")
                    .header("authorization", format!("Bearer {token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(second_response.status(), StatusCode::OK);
        let second_principal_id = parse_principal_id_from_response(second_response).await;

        assert_eq!(first_principal_id, second_principal_id);
    }

    #[tokio::test]
    async fn protected_endpoint_concurrent_retry_reuses_same_principal() {
        let app = app_for_test().await;
        let token = format!("u-concurrent:{}", unix_timestamp_seconds() + 300);

        let mut handles = Vec::new();
        for _ in 0..6 {
            let app_clone = app.clone();
            let token_clone = token.clone();
            handles.push(tokio::spawn(async move {
                app_clone
                    .oneshot(
                        Request::builder()
                            .uri("/protected/ping")
                            .header("authorization", format!("Bearer {token_clone}"))
                            .body(Body::empty())
                            .unwrap(),
                    )
                    .await
                    .unwrap()
            }));
        }

        let mut principal_ids = Vec::new();
        for handle in handles {
            let response = handle.await.unwrap();
            assert_eq!(response.status(), StatusCode::OK);
            principal_ids.push(parse_principal_id_from_response(response).await);
        }

        let expected = principal_ids.first().copied().unwrap();
        assert!(
            principal_ids.iter().all(|principal_id| *principal_id == expected),
            "all concurrent retries must resolve to the same principal_id"
        );
    }

    #[tokio::test]
    async fn protected_endpoint_returns_forbidden_when_authz_denied() {
        let app = app_for_test_with_authorizer(Arc::new(StaticDenyAuthorizer)).await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/protected/ping")
                    .header("authorization", format!("Bearer {token}"))
                    .header("x-request-id", "authz-denied-test")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::FORBIDDEN);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "AUTHZ_DENIED");
        assert_eq!(json["request_id"], "authz-denied-test");
    }

    #[tokio::test]
    async fn protected_endpoint_returns_unavailable_when_authz_unavailable() {
        let app = app_for_test_with_authorizer(Arc::new(StaticUnavailableAuthorizer)).await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/protected/ping")
                    .header("authorization", format!("Bearer {token}"))
                    .header("x-request-id", "authz-unavailable-test")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "AUTHZ_UNAVAILABLE");
        assert_eq!(json["request_id"], "authz-unavailable-test");
    }

    #[tokio::test]
    async fn list_guilds_returns_member_scoped_result() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/guilds")
                    .header("authorization", format!("Bearer {token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["guilds"][0]["guild_id"], 2001);
        assert_eq!(json["guilds"][0]["name"], "LinkLynx Developers");
    }

    #[tokio::test]
    async fn list_guild_channels_returns_forbidden_for_non_member() {
        let app = app_for_test().await;
        let token = format!("u-unknown:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/guilds/2001/channels")
                    .header("authorization", format!("Bearer {token}"))
                    .header("x-request-id", "non-member-test")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::FORBIDDEN);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "AUTHZ_DENIED");
        assert_eq!(json["request_id"], "non-member-test");
    }

    #[tokio::test]
    async fn list_guild_channels_returns_not_found_for_unknown_guild() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/guilds/9999/channels")
                    .header("authorization", format!("Bearer {token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::NOT_FOUND);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "GUILD_NOT_FOUND");
    }

    #[tokio::test]
    async fn list_guild_channels_rejects_non_numeric_guild_id() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/guilds/abc/channels")
                    .header("authorization", format!("Bearer {token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "VALIDATION_ERROR");
    }

    #[tokio::test]
    async fn list_guild_channels_rejects_non_positive_guild_id() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/guilds/0/channels")
                    .header("authorization", format!("Bearer {token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "VALIDATION_ERROR");
    }

    #[tokio::test]
    async fn create_guild_channel_rejects_malformed_json() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/guilds/2001/channels")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"name":"oops""#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "VALIDATION_ERROR");
    }

    #[tokio::test]
    async fn create_guild_rejects_blank_name() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/guilds")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"name":"   "}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "VALIDATION_ERROR");
    }

    #[tokio::test]
    async fn create_guild_returns_created() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/guilds")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"name":"My Guild"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::CREATED);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["guild"]["guild_id"], 2002);
        assert_eq!(json["guild"]["name"], "My Guild");
        assert_eq!(json["guild"]["owner_id"], 1001);
    }

    #[tokio::test]
    async fn create_guild_channel_returns_created_for_member() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/guilds/2001/channels")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"name":"release"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::CREATED);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["channel"]["guild_id"], 2001);
        assert_eq!(json["channel"]["name"], "release");
    }

    #[tokio::test]
    async fn ws_ticket_endpoint_returns_ticket_for_authenticated_request() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/auth/ws-ticket")
                    .header("authorization", format!("Bearer {token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert!(json["ticket"].as_str().is_some_and(|value| !value.is_empty()));
        assert!(json["expiresAt"].as_str().is_some_and(|value| !value.is_empty()));
    }

    #[tokio::test]
    async fn ws_ticket_endpoint_rejects_missing_token() {
        let app = app_for_test().await;

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/auth/ws-ticket")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn get_my_profile_returns_profile() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/users/me/profile")
                    .header("authorization", format!("Bearer {token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["profile"]["display_name"], "Alice");
        assert_eq!(json["profile"]["status_text"], "Ready");
        assert_eq!(json["profile"]["avatar_key"], "avatars/alice.png");
    }

    #[tokio::test]
    async fn patch_my_profile_updates_display_name() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/users/me/profile")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"display_name":"  New Name  "}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["profile"]["display_name"], "New Name");
    }

    #[tokio::test]
    async fn patch_my_profile_clears_status_text_with_blank_input() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/users/me/profile")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"status_text":"   "}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["profile"]["status_text"], serde_json::Value::Null);
    }

    #[tokio::test]
    async fn patch_my_profile_rejects_empty_payload() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/users/me/profile")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "VALIDATION_ERROR");
    }

    #[tokio::test]
    async fn patch_my_profile_rejects_invalid_avatar_key_format() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/users/me/profile")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"avatar_key":"bad key"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "VALIDATION_ERROR");
    }

    #[tokio::test]
    async fn patch_my_profile_rejects_null_display_name() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/users/me/profile")
                    .header("authorization", format!("Bearer {token}"))
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"display_name":null,"status_text":"hello"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "VALIDATION_ERROR");
    }

    #[tokio::test]
    async fn get_my_profile_returns_not_found_for_missing_user() {
        let app = app_for_test().await;
        let token = format!("u-unknown:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/users/me/profile")
                    .header("authorization", format!("Bearer {token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::NOT_FOUND);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "USER_NOT_FOUND");
    }

    #[tokio::test]
    async fn get_my_profile_returns_unavailable_when_dependency_unavailable() {
        let app = app_for_test_with_authorizer_and_profile(
            Arc::new(StaticAllowAllAuthorizer),
            Arc::new(StaticUnavailableProfileService),
        )
        .await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/users/me/profile")
                    .header("authorization", format!("Bearer {token}"))
                    .header("x-request-id", "profile-unavailable-test")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "PROFILE_UNAVAILABLE");
        assert_eq!(json["request_id"], "profile-unavailable-test");
    }

    #[tokio::test]
    async fn invite_dm_moderation_endpoints_apply_role_based_allow_and_deny() {
        let app = app_for_test_with_authorizer(Arc::new(RoleScenarioAuthorizer)).await;

        let owner_token = format!("u-owner:{}", unix_timestamp_seconds() + 300);
        let owner_invite_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/v1/guilds/10/invites/invite-abc")
                    .header("authorization", format!("Bearer {owner_token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(owner_invite_response.status(), StatusCode::OK);

        let member_token = format!("u-member:{}", unix_timestamp_seconds() + 300);
        let member_dm_get_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/v1/dms/55/messages")
                    .header("authorization", format!("Bearer {member_token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(member_dm_get_response.status(), StatusCode::OK);

        let member_dm_post_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/v1/dms/55/messages")
                    .header("authorization", format!("Bearer {member_token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(member_dm_post_response.status(), StatusCode::OK);

        let member_moderation_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/v1/moderation/guilds/10/members/9003")
                    .header("authorization", format!("Bearer {member_token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(member_moderation_response.status(), StatusCode::FORBIDDEN);

        let admin_token = format!("u-admin:{}", unix_timestamp_seconds() + 300);
        let admin_moderation_response = app
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/v1/moderation/guilds/10/members/9003")
                    .header("authorization", format!("Bearer {admin_token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(admin_moderation_response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn moderation_endpoint_returns_unavailable_when_authz_unavailable() {
        let app = app_for_test_with_authorizer(Arc::new(StaticUnavailableAuthorizer)).await;
        let token = format!("u-owner:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/v1/moderation/guilds/10/members/9003")
                    .header("authorization", format!("Bearer {token}"))
                    .header("x-request-id", "moderation-authz-unavailable-test")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "AUTHZ_UNAVAILABLE");
        assert_eq!(json["request_id"], "moderation-authz-unavailable-test");
    }

    #[test]
    fn rest_authz_resource_maps_invite_dm_and_moderation_paths() {
        match rest_authz_resource_from_path("/v1/guilds/10/invites/invite-abc") {
            AuthzResource::Guild { guild_id } => assert_eq!(guild_id, 10),
            _ => panic!("invite path should map to guild resource"),
        }

        match rest_authz_resource_from_path("/v1/dms/55/messages") {
            AuthzResource::Channel { channel_id } => assert_eq!(channel_id, 55),
            _ => panic!("dm path should map to channel resource"),
        }

        match rest_authz_resource_from_path("/v1/moderation/guilds/10/members/9003") {
            AuthzResource::Guild { guild_id } => assert_eq!(guild_id, 10),
            _ => panic!("moderation path should map to guild resource"),
        }
    }

    #[test]
    fn parse_reauth_id_token_extracts_token() {
        let text = r#"{"type":"auth.reauthenticate","d":{"idToken":"next-token"}}"#;
        assert_eq!(parse_reauth_id_token(text), Some("next-token".to_owned()));
    }

    #[test]
    fn parse_reauth_id_token_ignores_non_reauth_messages() {
        let text = r#"{"type":"message.create","body":"hi"}"#;
        assert_eq!(parse_reauth_id_token(text), None);
    }

    #[test]
    fn parse_identify_payload_extracts_ticket() {
        let text = r#"{"type":"auth.identify","d":{"method":"ticket","ticket":"abc"}}"#;
        let payload = parse_identify_payload(text).unwrap();

        assert_eq!(payload.method, "ticket");
        assert_eq!(payload.ticket, "abc");
    }
}
