use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    response::IntoResponse,
    routing::get,
    Router,
};
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() {
    tracing_subscriber::registry()
        .with(tracing_subscriber::fmt::layer())
        .with(tracing_filter_from_env())
        .init();

    let app = app();

    let addr = server_addr();
    tracing::info!("Server running on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

fn default_log_filter() -> &'static str {
    "info"
}

fn tracing_filter_from_env() -> tracing_subscriber::EnvFilter {
    tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| default_log_filter().into())
}

fn server_addr() -> SocketAddr {
    SocketAddr::from(([0, 0, 0, 0], 8080))
}

async fn root() -> &'static str {
    "LinkLynx API Server"
}

async fn health_check() -> &'static str {
    "OK"
}

fn app() -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        .route("/", get(root))
        .route("/health", get(health_check))
        .route("/ws", get(ws_handler))
        .layer(cors)
}

async fn ws_handler(ws: WebSocketUpgrade) -> impl IntoResponse {
    ws.on_upgrade(handle_socket)
}

async fn handle_socket(mut socket: WebSocket) {
    while let Some(msg) = socket.recv().await {
        if let Ok(msg) = msg {
            match msg {
                Message::Text(text) => {
                    tracing::info!("Received: {}", text);
                    if socket.send(Message::Text(text)).await.is_err() {
                        break;
                    }
                }
                Message::Close(_) => break,
                _ => {}
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{app, default_log_filter, server_addr};
    use axum::{
        body::{to_bytes, Body},
        http::{Request, StatusCode},
    };
    use futures_util::{SinkExt, StreamExt};
    use tokio::time::{timeout, Duration};
    use tokio_tungstenite::{connect_async, tungstenite::Message as TungsteniteMessage};
    use tower::ServiceExt;

    const MAX_RESPONSE_BYTES: usize = 16 * 1024;

    #[tokio::test]
    async fn root_returns_server_name() {
        let app = app();
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
        let app = app();
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

    #[test]
    fn default_log_filter_is_info() {
        assert_eq!(default_log_filter(), "info");
    }

    #[test]
    fn server_addr_is_contract_value() {
        assert_eq!(server_addr(), "0.0.0.0:8080".parse().unwrap());
    }

    #[tokio::test]
    async fn websocket_echoes_text_message() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            axum::serve(listener, app()).await.unwrap();
        });

        let (mut socket, _response) = connect_async(format!("ws://{addr}/ws")).await.unwrap();

        socket
            .send(TungsteniteMessage::Binary(vec![1_u8, 2_u8, 3_u8].into()))
            .await
            .unwrap();
        socket
            .send(TungsteniteMessage::Text("hello".into()))
            .await
            .unwrap();

        let echoed = timeout(Duration::from_secs(1), socket.next())
            .await
            .unwrap()
            .unwrap()
            .unwrap();
        assert_eq!(echoed, TungsteniteMessage::Text("hello".into()));

        socket.send(TungsteniteMessage::Close(None)).await.unwrap();

        server.abort();
        let _ = server.await;
    }
}
