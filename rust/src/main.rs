use axum::{
    extract::State,
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    http::StatusCode,
    response::Json,
    response::IntoResponse,
    routing::post,
    routing::get,
    Router,
};
use channel_reads::{ChannelReadUpsertInput, ChannelReadsError, ChannelReadsRepository};
use outbox::{NoopEventPublisher, OutboxWorker, OutboxWorkerConfig};
use serde::{Deserialize, Serialize};
use sqlx::postgres::PgPoolOptions;
use std::net::SocketAddr;
use std::time::Duration;
use tower_http::cors::{Any, CorsLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod channel_reads;
mod last_message_worker;
mod outbox;
mod search_indexer;

#[derive(Clone)]
struct AppState {
    channel_reads_repo: ChannelReadsRepository,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::registry()
        .with(tracing_subscriber::fmt::layer())
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info".into()),
        )
        .init();

    let db_pool = std::env::var("DATABASE_URL")
        .ok()
        .and_then(|database_url| {
            PgPoolOptions::new()
                .acquire_timeout(Duration::from_secs(3))
                .max_connections(5)
                .connect_lazy(&database_url)
                .ok()
        });

    let state = AppState {
        channel_reads_repo: ChannelReadsRepository::new(db_pool.clone()),
    };

    if should_enable_outbox_worker() {
        if let Some(pool) = db_pool {
            let worker = OutboxWorker::new(pool, NoopEventPublisher, OutboxWorkerConfig::default());
            tokio::spawn(worker.run_loop());
            tracing::info!("outbox worker started");
        } else {
            tracing::warn!("outbox worker requested, but DATABASE_URL is not configured");
        }
    }

    let app = app(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], 8080));
    tracing::info!("Server running on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn root() -> &'static str {
    "LinkLynx API Server"
}

async fn health_check() -> &'static str {
    "OK"
}

fn app(state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        .route("/", get(root))
        .route("/health", get(health_check))
        .route("/ws", get(ws_handler))
        .route("/internal/channel-reads", post(upsert_channel_reads))
        .with_state(state)
        .layer(cors)
}

#[derive(Debug, Deserialize, Serialize)]
struct ErrorBody {
    error: String,
}

async fn upsert_channel_reads(
    State(state): State<AppState>,
    Json(input): Json<ChannelReadUpsertInput>,
) -> Result<StatusCode, (StatusCode, Json<ErrorBody>)> {
    state
        .channel_reads_repo
        .upsert(&input)
        .await
        .map_err(map_channel_reads_error)?;
    Ok(StatusCode::NO_CONTENT)
}

fn map_channel_reads_error(err: ChannelReadsError) -> (StatusCode, Json<ErrorBody>) {
    match err {
        ChannelReadsError::DbUnavailable => (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(ErrorBody {
                error: "database is unavailable".to_string(),
            }),
        ),
        ChannelReadsError::Query(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorBody {
                error: "database query failed".to_string(),
            }),
        ),
    }
}

fn should_enable_outbox_worker() -> bool {
    std::env::var("OUTBOX_WORKER_ENABLED")
        .map(|value| value.eq_ignore_ascii_case("true") || value == "1")
        .unwrap_or(false)
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
    use super::{app, AppState, ErrorBody};
    use axum::{
        body::{to_bytes, Body},
        http::{Request, StatusCode},
    };
    use crate::channel_reads::ChannelReadsRepository;
    use serde_json::json;
    use tower::ServiceExt;

    const MAX_RESPONSE_BYTES: usize = 16 * 1024;

    #[tokio::test]
    async fn root_returns_server_name() {
        let app = app(AppState {
            channel_reads_repo: ChannelReadsRepository::new(None),
        });
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
        let app = app(AppState {
            channel_reads_repo: ChannelReadsRepository::new(None),
        });
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
    async fn channel_reads_requires_database() {
        let app = app(AppState {
            channel_reads_repo: ChannelReadsRepository::new(None),
        });
        let payload = json!({
          "channel_id": 10,
          "user_id": 20,
          "last_read_message_id": 120,
          "last_client_seq": 8
        });

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/internal/channel-reads")
                    .header("content-type", "application/json")
                    .body(Body::from(payload.to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
        let body = to_bytes(response.into_body(), MAX_RESPONSE_BYTES)
            .await
            .unwrap();
        let parsed: ErrorBody = serde_json::from_slice(body.as_ref()).unwrap();
        assert_eq!(parsed.error, "database is unavailable".to_string());
    }
}
