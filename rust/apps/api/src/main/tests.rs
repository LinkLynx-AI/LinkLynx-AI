#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;
    use auth::{
        CachingPrincipalResolver, InMemoryPrincipalCache, InMemoryPrincipalStore,
        PrincipalResolver, TokenVerifier, TokenVerifyError, VerifiedToken,
    };
    use axum::{
        body::to_bytes,
        http::{HeaderValue, Method, StatusCode},
    };
    use linklynx_shared::PrincipalId;
    use tower::ServiceExt;

    const MAX_RESPONSE_BYTES: usize = 16 * 1024;

    struct StaticTokenVerifier;

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
                expires_at_epoch: exp,
            })
        }
    }

    fn test_http_middleware_config() -> HttpMiddlewareConfig {
        HttpMiddlewareConfig {
            cors_allow_origins: vec![
                HeaderValue::from_static("http://localhost:3000"),
                HeaderValue::from_static("http://127.0.0.1:3000"),
            ],
            body_limit_bytes: 16 * 1024,
            request_timeout: Duration::from_secs(5),
            retry_after_seconds: 1,
        }
    }

    async fn app_for_test_with_http_config(http_middleware: HttpMiddlewareConfig) -> Router {
        let metrics = Arc::new(AuthMetrics::default());
        let verifier: Arc<dyn TokenVerifier> = Arc::new(StaticTokenVerifier);

        let store = InMemoryPrincipalStore::default();
        store.insert("firebase", "u-1", PrincipalId(1001)).await;

        let resolver: Arc<dyn PrincipalResolver> = Arc::new(CachingPrincipalResolver::new(
            "firebase".to_owned(),
            Arc::new(InMemoryPrincipalCache::default()),
            Arc::new(store),
            Duration::from_secs(120),
            Arc::clone(&metrics),
        ));

        let auth_service = Arc::new(AuthService::new(verifier, resolver, metrics));
        let state = AppState {
            auth_service,
            ws_reauth_grace: Duration::from_secs(30),
            http_middleware,
        };

        app_with_state(state)
    }

    async fn app_for_test() -> Router {
        app_for_test_with_http_config(test_http_middleware_config()).await
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
        assert!(json["expires_at_epoch"].as_u64().is_some());
    }

    #[tokio::test]
    async fn protected_endpoint_returns_forbidden_when_mapping_missing() {
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

        assert_eq!(response.status(), StatusCode::FORBIDDEN);
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

    #[test]
    fn normalize_origin_removes_trailing_slash() {
        assert_eq!(
            normalize_origin("https://app.example.com/"),
            Some("https://app.example.com".to_owned())
        );
    }

    #[test]
    fn normalize_origin_rejects_path_segments() {
        assert_eq!(normalize_origin("https://app.example.com/path"), None);
    }

    #[tokio::test]
    async fn cors_preflight_allows_allowlisted_origin_without_auth_rejection() {
        let app = app_for_test().await;
        let response = app
            .oneshot(
                Request::builder()
                    .method(Method::OPTIONS)
                    .uri("/v1/protected/ping")
                    .header("origin", "http://localhost:3000")
                    .header("access-control-request-method", "GET")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_ne!(response.status(), StatusCode::UNAUTHORIZED);
        assert_eq!(
            response
                .headers()
                .get("access-control-allow-origin")
                .unwrap(),
            "http://localhost:3000"
        );
    }

    #[tokio::test]
    async fn cors_preflight_omits_allow_origin_for_non_allowlisted_origin() {
        let app = app_for_test().await;
        let response = app
            .oneshot(
                Request::builder()
                    .method(Method::OPTIONS)
                    .uri("/v1/protected/ping")
                    .header("origin", "https://malicious.example")
                    .header("access-control-request-method", "GET")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_ne!(response.status(), StatusCode::UNAUTHORIZED);
        assert!(response
            .headers()
            .get("access-control-allow-origin")
            .is_none());
    }

    #[tokio::test]
    async fn protected_endpoint_returns_429_when_body_limit_is_exceeded() {
        let mut config = test_http_middleware_config();
        config.body_limit_bytes = 8;
        let app = app_for_test_with_http_config(config).await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/v1/protected/ping")
                    .header("authorization", format!("Bearer {token}"))
                    .header("x-request-id", "limit-req-id")
                    .header("content-length", "16")
                    .body(Body::from("0123456789ABCDEF"))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::TOO_MANY_REQUESTS);
        assert_eq!(response.headers().get("retry-after").unwrap(), "1");
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "INPUT_LIMIT_BODY_TOO_LARGE");
        assert_eq!(json["request_id"], "limit-req-id");
    }

    #[tokio::test]
    async fn protected_endpoint_returns_429_for_transfer_encoding_requests() {
        let app = app_for_test().await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/v1/protected/ping")
                    .header("authorization", format!("Bearer {token}"))
                    .header("x-request-id", "te-req-id")
                    .header("transfer-encoding", "chunked")
                    .body(Body::from("x"))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::TOO_MANY_REQUESTS);
        assert_eq!(response.headers().get("retry-after").unwrap(), "1");
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "INPUT_LIMIT_TRANSFER_ENCODING_UNSUPPORTED");
        assert_eq!(json["request_id"], "te-req-id");
    }

    #[tokio::test]
    async fn protected_endpoint_returns_429_when_processing_times_out() {
        let mut config = test_http_middleware_config();
        config.request_timeout = Duration::from_millis(1);
        let app = app_for_test_with_http_config(config).await;
        let token = format!("u-1:{}", unix_timestamp_seconds() + 300);
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/v1/protected/slow")
                    .header("authorization", format!("Bearer {token}"))
                    .header("x-request-id", "timeout-req-id")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::TOO_MANY_REQUESTS);
        assert_eq!(response.headers().get("retry-after").unwrap(), "1");
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let json = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        assert_eq!(json["code"], "INPUT_LIMIT_TIMEOUT");
        assert_eq!(json["request_id"], "timeout-req-id");
    }
}
