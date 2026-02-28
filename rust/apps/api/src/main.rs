mod auth;

use std::{
    collections::BTreeSet,
    env,
    net::SocketAddr,
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
    http::{HeaderMap, HeaderValue, Request, Uri},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use tower_http::cors::{Any, CorsLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

const DEFAULT_WS_REAUTH_GRACE_SECONDS: u64 = 30;
const DEFAULT_HTTP_BODY_LIMIT_BYTES: usize = 1_048_576;
const DEFAULT_HTTP_REQUEST_TIMEOUT_MS: u64 = 5_000;
const DEFAULT_HTTP_RETRY_AFTER_SECONDS: u64 = 1;
const DEFAULT_CORS_ALLOW_ORIGINS: [&str; 2] = ["http://localhost:3000", "http://127.0.0.1:3000"];

#[derive(Clone, Debug)]
pub(crate) struct HttpMiddlewareConfig {
    cors_allow_origins: Vec<HeaderValue>,
    body_limit_bytes: usize,
    request_timeout: Duration,
    retry_after_seconds: u64,
}

#[derive(Clone)]
pub(crate) struct AppState {
    auth_service: Arc<AuthService>,
    ws_reauth_grace: Duration,
    http_middleware: HttpMiddlewareConfig,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::registry()
        .with(tracing_subscriber::fmt::layer())
        .with(tracing_filter_from_env())
        .init();

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
    let ws_reauth_grace = Duration::from_secs(parse_env_u64(
        "WS_REAUTH_GRACE_SECONDS",
        DEFAULT_WS_REAUTH_GRACE_SECONDS,
    ));

    AppState {
        auth_service,
        ws_reauth_grace,
        http_middleware: build_http_middleware_config(),
    }
}

/// HTTPミドルウェア設定を環境変数から構築する。
/// @param なし
/// @returns HTTPミドルウェア設定
/// @throws なし
fn build_http_middleware_config() -> HttpMiddlewareConfig {
    let body_limit_u64 = parse_env_u64(
        "HTTP_BODY_LIMIT_BYTES",
        DEFAULT_HTTP_BODY_LIMIT_BYTES as u64,
    );
    let body_limit_bytes = usize::try_from(body_limit_u64).unwrap_or(DEFAULT_HTTP_BODY_LIMIT_BYTES);
    let timeout_ms = parse_env_u64(
        "HTTP_REQUEST_TIMEOUT_MILLIS",
        DEFAULT_HTTP_REQUEST_TIMEOUT_MS,
    );
    let retry_after_seconds =
        parse_env_u64("HTTP_RETRY_AFTER_SECONDS", DEFAULT_HTTP_RETRY_AFTER_SECONDS);

    HttpMiddlewareConfig {
        cors_allow_origins: parse_cors_allow_origins(),
        body_limit_bytes,
        request_timeout: Duration::from_millis(timeout_ms),
        retry_after_seconds,
    }
}

/// 整数環境変数を取得する。
/// @param key 環境変数名
/// @param default_value 既定値
/// @returns 取得した値または既定値
/// @throws なし
fn parse_env_u64(key: &str, default_value: u64) -> u64 {
    env::var(key)
        .ok()
        .and_then(|value| value.parse::<u64>().ok())
        .unwrap_or(default_value)
}

/// CORS許可Origin一覧を環境変数から取得する。
/// @param なし
/// @returns CORS許可Originのヘッダー値一覧
/// @throws なし
fn parse_cors_allow_origins() -> Vec<HeaderValue> {
    let configured = match env::var("CORS_ALLOW_ORIGINS") {
        Ok(raw) => raw
            .split(',')
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_owned)
            .collect::<Vec<String>>(),
        Err(_) => {
            tracing::warn!("CORS_ALLOW_ORIGINS is not set; using secure localhost defaults");
            DEFAULT_CORS_ALLOW_ORIGINS
                .iter()
                .map(ToString::to_string)
                .collect::<Vec<String>>()
        }
    };

    let mut unique_values = BTreeSet::new();
    for value in configured {
        let Some(normalized) = normalize_origin(&value) else {
            tracing::warn!(
                origin = %value,
                "invalid CORS origin found in CORS_ALLOW_ORIGINS and skipped"
            );
            continue;
        };
        if HeaderValue::from_str(&normalized).is_err() {
            tracing::warn!(
                origin = %normalized,
                "CORS origin is syntactically invalid as header value and skipped"
            );
            continue;
        }
        unique_values.insert(normalized);
    }

    if unique_values.is_empty() {
        return DEFAULT_CORS_ALLOW_ORIGINS
            .iter()
            .map(|origin| HeaderValue::from_str(origin).expect("default CORS origin must be valid"))
            .collect();
    }

    unique_values
        .into_iter()
        .map(|origin| HeaderValue::from_str(&origin).expect("validated CORS origin must be valid"))
        .collect()
}

/// Origin文字列をCORS比較用の正規形式へ変換する。
/// @param origin Origin文字列
/// @returns `scheme://authority` 形式の正規化結果
/// @throws なし
fn normalize_origin(origin: &str) -> Option<String> {
    let Ok(uri) = origin.parse::<Uri>() else {
        return None;
    };

    let scheme_is_valid = matches!(uri.scheme_str(), Some("http" | "https"));
    if !scheme_is_valid || uri.authority().is_none() {
        return None;
    }
    if !(uri.path().is_empty() || uri.path() == "/") || uri.query().is_some() {
        return None;
    }

    let scheme = uri.scheme_str().expect("scheme validated");
    let authority = uri.authority().expect("authority validated");
    Some(format!("{scheme}://{authority}"))
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
