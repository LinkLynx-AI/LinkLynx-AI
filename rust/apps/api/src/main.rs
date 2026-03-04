mod auth;
mod authz;

use std::{
    env,
    net::SocketAddr,
    sync::Arc,
    time::{Duration, Instant},
};

use auth::{
    auth_error_response, bearer_token_from_headers, build_runtime_auth_service,
    request_id_from_headers, unix_timestamp_seconds, validate_runtime_auth_env, AuthContext,
    AuthMetrics, AuthMetricsSnapshot, AuthService, AuthenticatedPrincipal,
};
use authz::{
    authz_error_response, build_runtime_authorizer, Authorizer, AuthzAction, AuthzCheckInput,
    AuthzMetrics, AuthzMetricsSnapshot, AuthzResource,
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
    authorizer: Arc<dyn Authorizer>,
    authz_metrics: Arc<AuthzMetrics>,
    ws_reauth_grace: Duration,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::registry()
        .with(tracing_subscriber::fmt::layer())
        .with(tracing_filter_from_env())
        .init();

    if let Err(reason) = validate_runtime_auth_env() {
        tracing::error!(reason = %reason, "runtime auth env validation failed on startup");
        return Err(std::io::Error::new(std::io::ErrorKind::InvalidInput, reason).into());
    }

    let app = app();

    let addr = server_addr();
    tracing::info!(address = %addr, "server starting");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
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

/// 実行時状態を構築する。
/// @param なし
/// @returns アプリケーション状態
/// @throws なし
fn build_runtime_state() -> AppState {
    let metrics = Arc::new(AuthMetrics::default());
    let auth_service = Arc::new(build_runtime_auth_service(Arc::clone(&metrics)));
    let authorizer = build_runtime_authorizer();
    let authz_metrics = Arc::new(AuthzMetrics::default());
    let ws_reauth_grace = Duration::from_secs(
        env::var("WS_REAUTH_GRACE_SECONDS")
            .ok()
            .and_then(|value| value.parse::<u64>().ok())
            .unwrap_or(30),
    );

    AppState {
        auth_service,
        authorizer,
        authz_metrics,
        ws_reauth_grace,
    }
}

/// 実行時ルータを構築する。
/// @param なし
/// @returns APIルータ
/// @throws なし
fn app() -> Router {
    app_with_state(build_runtime_state())
}

include!("main/http_routes.rs");
include!("main/ws_routes.rs");
include!("main/tests.rs");
