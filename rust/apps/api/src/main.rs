mod auth;

use std::{
    env,
    sync::Arc,
    time::{Duration, Instant},
};

use auth::{
    auth_error_response, bearer_token_from_headers, build_runtime_auth_service,
    request_id_from_headers, unix_timestamp_seconds, AuthContext, AuthMetrics, AuthMetricsSnapshot,
    AuthService, AuthenticatedPrincipal,
};
use axum::{
    body::Body,
    extract::{
        ws::{CloseFrame, Message, WebSocket, WebSocketUpgrade},
        Extension, State,
    },
    http::{HeaderMap, Request},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use tower_http::cors::{Any, CorsLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[derive(Clone)]
pub(crate) struct AppState {
    auth_service: Arc<AuthService>,
    ws_reauth_grace: Duration,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::registry()
        .with(tracing_subscriber::fmt::layer())
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()),
        )
        .init();

    let app = app();

    let addr = std::net::SocketAddr::from(([0, 0, 0, 0], 8080));
    tracing::info!(address = %addr, "server starting");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

/// 実行時ルータを構築する。
/// @param なし
/// @returns APIルータ
/// @throws なし
fn app() -> Router {
    app_with_state(build_runtime_state())
}

/// 実行時状態を構築する。
/// @param なし
/// @returns アプリケーション状態
/// @throws なし
fn build_runtime_state() -> AppState {
    let metrics = Arc::new(AuthMetrics::default());
    let auth_service = Arc::new(build_runtime_auth_service(Arc::clone(&metrics)));
    let ws_reauth_grace = Duration::from_secs(
        env::var("WS_REAUTH_GRACE_SECONDS")
            .ok()
            .and_then(|value| value.parse::<u64>().ok())
            .unwrap_or(30),
    );

    AppState {
        auth_service,
        ws_reauth_grace,
    }
}

/// 状態付きルータを構築する。
/// @param state アプリケーション状態
/// @returns APIルータ
/// @throws なし
fn app_with_state(state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let protected_routes = Router::new()
        .route("/v1/protected/ping", get(protected_ping))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            rest_auth_middleware,
        ));

    Router::new()
        .route("/", get(root))
        .route("/health", get(health_check))
        .route("/ws", get(ws_handler))
        .route("/internal/auth/metrics", get(auth_metrics_handler))
        .merge(protected_routes)
        .with_state(state)
        .layer(cors)
}

/// ルート疎通応答を返す。
/// @param なし
/// @returns サーバー識別文字列
/// @throws なし
async fn root() -> &'static str {
    "LinkLynx API Server"
}

/// ヘルスチェック応答を返す。
/// @param なし
/// @returns 正常時の固定文字列
/// @throws なし
async fn health_check() -> &'static str {
    "OK"
}

#[derive(Debug, Serialize)]
struct ProtectedPingResponse {
    ok: bool,
    request_id: String,
    principal_id: i64,
    firebase_uid: String,
}

/// 認証済みエンドポイントの疎通応答を返す。
/// @param auth_context 認証文脈
/// @returns 認証済み応答
/// @throws なし
async fn protected_ping(
    Extension(auth_context): Extension<AuthContext>,
) -> Json<ProtectedPingResponse> {
    Json(ProtectedPingResponse {
        ok: true,
        request_id: auth_context.request_id,
        principal_id: auth_context.principal_id.0,
        firebase_uid: auth_context.firebase_uid,
    })
}

/// 認証メトリクスを返す。
/// @param state アプリケーション状態
/// @returns 認証メトリクス
/// @throws なし
async fn auth_metrics_handler(State(state): State<AppState>) -> Json<AuthMetricsSnapshot> {
    Json(state.auth_service.metrics().snapshot())
}

/// REST認証ミドルウェアを実行する。
/// @param state アプリケーション状態
/// @param request HTTPリクエスト
/// @param next 次のハンドラ
/// @returns 認証後レスポンス
/// @throws なし
async fn rest_auth_middleware(
    State(state): State<AppState>,
    mut request: Request<Body>,
    next: Next,
) -> Response {
    let request_id = request_id_from_headers(request.headers());

    let token = match bearer_token_from_headers(request.headers()) {
        Ok(token) => token,
        Err(error) => {
            tracing::warn!(
                decision = %error.decision(),
                request_id = %request_id,
                error_class = %error.log_class(),
                reason = %error.reason,
                "REST auth rejected at header parsing"
            );
            return auth_error_response(&error, request_id);
        }
    };

    let authenticated = match state.auth_service.authenticate_token(&token).await {
        Ok(authenticated) => authenticated,
        Err(error) => {
            tracing::warn!(
                decision = %error.decision(),
                request_id = %request_id,
                error_class = %error.log_class(),
                reason = %error.reason,
                "REST auth rejected"
            );
            return auth_error_response(&error, request_id);
        }
    };

    tracing::info!(
        decision = "allow",
        request_id = %request_id,
        principal_id = authenticated.principal_id.0,
        firebase_uid = %authenticated.firebase_uid,
        "REST auth accepted"
    );

    request.extensions_mut().insert(AuthContext {
        request_id,
        principal_id: authenticated.principal_id,
        firebase_uid: authenticated.firebase_uid,
    });

    next.run(request).await
}

/// WS接続ハンドシェイクを処理する。
/// @param state アプリケーション状態
/// @param headers HTTPヘッダー
/// @param ws WSアップグレード
/// @returns ハンドシェイク応答
/// @throws なし
async fn ws_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    ws: WebSocketUpgrade,
) -> Response {
    let request_id = request_id_from_headers(&headers);
    let token = match bearer_token_from_headers(&headers) {
        Ok(token) => token,
        Err(error) => {
            tracing::warn!(
                decision = %error.decision(),
                request_id = %request_id,
                error_class = %error.log_class(),
                reason = %error.reason,
                "WS auth rejected at header parsing"
            );
            return auth_error_response(&error, request_id);
        }
    };

    let authenticated = match state.auth_service.authenticate_token(&token).await {
        Ok(authenticated) => authenticated,
        Err(error) => {
            tracing::warn!(
                decision = %error.decision(),
                request_id = %request_id,
                error_class = %error.log_class(),
                reason = %error.reason,
                "WS auth rejected at handshake"
            );
            return auth_error_response(&error, request_id);
        }
    };

    tracing::info!(
        decision = "allow",
        request_id = %request_id,
        principal_id = authenticated.principal_id.0,
        firebase_uid = %authenticated.firebase_uid,
        "WS auth accepted at handshake"
    );

    ws.on_upgrade(move |socket| handle_socket(socket, state, authenticated, request_id))
        .into_response()
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
enum ClientWsMessage {
    #[serde(rename = "auth.reauthenticate")]
    Reauthenticate { token: String },
}

/// テキストメッセージから再認証トークンを抽出する。
/// @param text クライアント送信テキスト
/// @returns 再認証トークン（存在時）
/// @throws なし
fn parse_reauth_token(text: &str) -> Option<String> {
    match serde_json::from_str::<ClientWsMessage>(text) {
        Ok(ClientWsMessage::Reauthenticate { token }) => Some(token),
        Err(_) => None,
    }
}

#[derive(Debug, Serialize)]
struct WsReauthenticateRequest<'a> {
    #[serde(rename = "type")]
    message_type: &'a str,
    deadline_epoch: u64,
    request_id: &'a str,
}

#[derive(Debug, Serialize)]
struct WsReauthenticateAck<'a> {
    #[serde(rename = "type")]
    message_type: &'a str,
    principal_id: i64,
    request_id: &'a str,
}

/// WSセッションを処理する。
/// @param socket WebSocket接続
/// @param state アプリケーション状態
/// @param authenticated 認証済み主体
/// @param request_id 接続識別子
/// @returns なし
/// @throws なし
async fn handle_socket(
    mut socket: WebSocket,
    state: AppState,
    mut authenticated: AuthenticatedPrincipal,
    request_id: String,
) {
    let mut reauth_deadline: Option<Instant> = None;

    loop {
        if let Some(deadline) = reauth_deadline {
            if Instant::now() >= deadline {
                state.auth_service.metrics().record_ws_reauth(false);
                let _ = close_socket(&mut socket, 1008, "reauth_timeout").await;
                break;
            }

            let timeout = deadline.saturating_duration_since(Instant::now());
            tokio::select! {
                incoming = socket.recv() => {
                    let Some(incoming) = incoming else {
                        break;
                    };

                    let Ok(message) = incoming else {
                        break;
                    };

                    let should_continue = handle_socket_message(
                        &state,
                        &mut socket,
                        &mut authenticated,
                        &request_id,
                        &mut reauth_deadline,
                        message,
                    ).await;

                    if !should_continue {
                        break;
                    }
                }
                _ = tokio::time::sleep(timeout) => {
                    state.auth_service.metrics().record_ws_reauth(false);
                    let _ = close_socket(&mut socket, 1008, "reauth_timeout").await;
                    break;
                }
            }
            continue;
        }

        let now = unix_timestamp_seconds();
        if now >= authenticated.expires_at_epoch {
            let deadline_epoch = now + state.ws_reauth_grace.as_secs();
            let request = WsReauthenticateRequest {
                message_type: "auth.reauthenticate",
                deadline_epoch,
                request_id: &request_id,
            };

            if send_json_message(&mut socket, &request).await.is_err() {
                break;
            }

            reauth_deadline = Some(Instant::now() + state.ws_reauth_grace);
            continue;
        }

        let wait_until_expired = Duration::from_secs(authenticated.expires_at_epoch - now);
        tokio::select! {
            incoming = socket.recv() => {
                let Some(incoming) = incoming else {
                    break;
                };

                let Ok(message) = incoming else {
                    break;
                };

                let should_continue = handle_socket_message(
                    &state,
                    &mut socket,
                    &mut authenticated,
                    &request_id,
                    &mut reauth_deadline,
                    message,
                ).await;

                if !should_continue {
                    break;
                }
            }
            _ = tokio::time::sleep(wait_until_expired) => {}
        }
    }
}

/// WS受信メッセージを処理する。
/// @param state アプリケーション状態
/// @param socket WebSocket接続
/// @param authenticated 認証済み主体
/// @param request_id 接続識別子
/// @param reauth_deadline 再認証期限
/// @param message 受信メッセージ
/// @returns 継続可否
/// @throws なし
async fn handle_socket_message(
    state: &AppState,
    socket: &mut WebSocket,
    authenticated: &mut AuthenticatedPrincipal,
    request_id: &str,
    reauth_deadline: &mut Option<Instant>,
    message: Message,
) -> bool {
    match message {
        Message::Text(text) => {
            let text = text.to_string();

            if let Some(token) = parse_reauth_token(&text) {
                match state.auth_service.authenticate_token(&token).await {
                    Ok(next_principal) => {
                        if next_principal.principal_id != authenticated.principal_id {
                            state.auth_service.metrics().record_ws_reauth(false);
                            tracing::warn!(
                                decision = "deny",
                                request_id = %request_id,
                                error_class = "principal_changed",
                                reason = "principal_changed",
                                "WS reauth rejected"
                            );
                            let _ = close_socket(socket, 1008, "principal_changed").await;
                            return false;
                        }

                        *authenticated = next_principal;
                        *reauth_deadline = None;
                        state.auth_service.metrics().record_ws_reauth(true);
                        tracing::info!(
                            decision = "allow",
                            request_id = %request_id,
                            principal_id = authenticated.principal_id.0,
                            firebase_uid = %authenticated.firebase_uid,
                            "WS reauth accepted"
                        );

                        let ack = WsReauthenticateAck {
                            message_type: "auth.reauthenticated",
                            principal_id: authenticated.principal_id.0,
                            request_id,
                        };

                        return send_json_message(socket, &ack).await.is_ok();
                    }
                    Err(error) => {
                        state.auth_service.metrics().record_ws_reauth(false);
                        tracing::warn!(
                            decision = %error.decision(),
                            request_id = %request_id,
                            error_class = %error.log_class(),
                            reason = %error.reason,
                            "WS reauth rejected"
                        );
                        let _ = close_socket(socket, error.ws_close_code(), error.app_code()).await;
                        return false;
                    }
                }
            }

            if reauth_deadline.is_some() {
                state.auth_service.metrics().record_ws_reauth(false);
                let _ = close_socket(socket, 1008, "reauth_required").await;
                return false;
            }

            socket.send(Message::Text(text.into())).await.is_ok()
        }
        Message::Binary(_) => {
            if reauth_deadline.is_some() {
                state.auth_service.metrics().record_ws_reauth(false);
                let _ = close_socket(socket, 1008, "reauth_required").await;
                return false;
            }
            true
        }
        Message::Ping(payload) => socket.send(Message::Pong(payload)).await.is_ok(),
        Message::Pong(_) => true,
        Message::Close(_) => false,
    }
}

/// WSへJSONメッセージを送信する。
/// @param socket WebSocket接続
/// @param payload 送信オブジェクト
/// @returns 送信成否
/// @throws なし
async fn send_json_message<T: Serialize>(socket: &mut WebSocket, payload: &T) -> Result<(), ()> {
    let text = serde_json::to_string(payload).map_err(|_| ())?;
    socket
        .send(Message::Text(text.into()))
        .await
        .map_err(|_| ())
}

/// 指定クローズコードでWSを切断する。
/// @param socket WebSocket接続
/// @param code クローズコード
/// @param reason 切断理由
/// @returns 送信成否
/// @throws なし
async fn close_socket(socket: &mut WebSocket, code: u16, reason: &str) -> Result<(), ()> {
    let frame = CloseFrame {
        code,
        reason: reason.to_owned().into(),
    };
    socket
        .send(Message::Close(Some(frame)))
        .await
        .map_err(|_| ())
}

#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;
    use auth::{
        CachingPrincipalResolver, InMemoryPrincipalCache, InMemoryPrincipalStore,
        PrincipalResolver, TokenVerifier, TokenVerifyError, VerifiedToken,
    };
    use axum::{body::to_bytes, http::StatusCode};
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

    async fn app_for_test() -> Router {
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
}
