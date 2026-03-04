#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;
    use auth::{
        CachingPrincipalResolver, InMemoryPrincipalCache, InMemoryPrincipalStore,
        PrincipalProvisioner, PrincipalResolver, PrincipalStore, TokenVerifier, TokenVerifyError,
        VerifiedToken,
    };
    use authz::{Authorizer, AuthzAction, AuthzCheckInput, AuthzError, AuthzResource};
    use axum::{body::to_bytes, http::StatusCode};
    use linklynx_shared::PrincipalId;
    use tower::ServiceExt;

    const MAX_RESPONSE_BYTES: usize = 16 * 1024;

    struct StaticTokenVerifier;
    struct StaticAllowAllAuthorizer;
    struct StaticDenyAuthorizer;
    struct StaticUnavailableAuthorizer;
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

    async fn app_for_test() -> Router {
        app_for_test_with_authorizer(Arc::new(StaticAllowAllAuthorizer)).await
    }

    async fn app_for_test_with_authorizer(authorizer: Arc<dyn Authorizer>) -> Router {
        let metrics = Arc::new(AuthMetrics::default());
        let verifier: Arc<dyn TokenVerifier> = Arc::new(StaticTokenVerifier);

        let store = Arc::new(InMemoryPrincipalStore::default());
        store.insert("firebase", "u-1", PrincipalId(1001)).await;
        store.insert("firebase", "u-owner", PrincipalId(9001)).await;
        store.insert("firebase", "u-admin", PrincipalId(9002)).await;
        store.insert("firebase", "u-member", PrincipalId(9003)).await;
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
            ws_reauth_grace: Duration::from_secs(30),
        };

        app_with_state(state)
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
                    .uri("/v1/protected/ping")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn protected_endpoint_accepts_valid_token() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/v1/protected/ping")
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
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/v1/protected/ping")
                    .header("authorization", format!("Bearer {token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn protected_endpoint_returns_forbidden_when_authz_denied() {
        let app = app_for_test_with_authorizer(Arc::new(StaticDenyAuthorizer)).await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/v1/protected/ping")
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
                    .uri("/v1/protected/ping")
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
    async fn authz_metrics_endpoint_counts_allow_decisions() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);

        let _ = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/v1/protected/ping")
                    .header("authorization", format!("Bearer {token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/internal/authz/metrics")
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
        assert_eq!(json["allow_total"], 1);
        assert_eq!(json["deny_total"], 0);
        assert_eq!(json["unavailable_total"], 0);
    }

    #[tokio::test]
    async fn authz_metrics_endpoint_counts_deny_decisions() {
        let app = app_for_test_with_authorizer(Arc::new(StaticDenyAuthorizer)).await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);

        let _ = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/v1/protected/ping")
                    .header("authorization", format!("Bearer {token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/internal/authz/metrics")
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
        assert_eq!(json["allow_total"], 0);
        assert_eq!(json["deny_total"], 1);
        assert_eq!(json["unavailable_total"], 0);
    }

    #[tokio::test]
    async fn authz_metrics_endpoint_counts_unavailable_decisions() {
        let app = app_for_test_with_authorizer(Arc::new(StaticUnavailableAuthorizer)).await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);

        let _ = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/v1/protected/ping")
                    .header("authorization", format!("Bearer {token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/internal/authz/metrics")
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
        assert_eq!(json["allow_total"], 0);
        assert_eq!(json["deny_total"], 0);
        assert_eq!(json["unavailable_total"], 1);
    }

    #[tokio::test]
    async fn guild_channel_message_endpoints_apply_role_based_allow_and_deny() {
        let app = app_for_test_with_authorizer(Arc::new(RoleScenarioAuthorizer)).await;

        let owner_token = format!("u-owner:{}", unix_timestamp_seconds() + 300);
        let owner_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/v1/guilds/10")
                    .header("authorization", format!("Bearer {owner_token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(owner_response.status(), StatusCode::OK);

        let admin_token = format!("u-admin:{}", unix_timestamp_seconds() + 300);
        let admin_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/v1/guilds/10")
                    .header("authorization", format!("Bearer {admin_token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(admin_response.status(), StatusCode::OK);

        let member_token = format!("u-member:{}", unix_timestamp_seconds() + 300);
        let member_manage_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/v1/guilds/10")
                    .header("authorization", format!("Bearer {member_token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(member_manage_response.status(), StatusCode::FORBIDDEN);

        let member_channel_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/v1/guilds/10/channels/20")
                    .header("authorization", format!("Bearer {member_token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(member_channel_response.status(), StatusCode::OK);

        let member_message_response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/v1/guilds/10/channels/20/messages")
                    .header("authorization", format!("Bearer {member_token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(member_message_response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn guild_endpoint_returns_unavailable_when_authz_unavailable() {
        let app = app_for_test_with_authorizer(Arc::new(StaticUnavailableAuthorizer)).await;
        let token = format!("u-owner:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/v1/guilds/10")
                    .header("authorization", format!("Bearer {token}"))
                    .header("x-request-id", "guild-authz-unavailable-test")
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
        assert_eq!(json["request_id"], "guild-authz-unavailable-test");
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
    fn parse_reauth_token_extracts_token() {
        let text = r#"{"type":"auth.reauthenticate","token":"next-token"}"#;
        assert_eq!(parse_reauth_token(text), Some("next-token".to_owned()));
    }

    #[test]
    fn parse_reauth_token_ignores_non_reauth_messages() {
        let text = r#"{"type":"message.create","body":"hi"}"#;
        assert_eq!(parse_reauth_token(text), None);
    }
}
