mod auth;
mod authz;
mod dm;
mod guild_channel;
mod invite;
mod message;
mod moderation;
mod profile;
mod ratelimit;
mod scylla_health;
mod user_directory;

use std::{
    collections::HashSet,
    env,
    net::SocketAddr,
    sync::Arc,
    time::{Duration, Instant},
};

use auth::{
    auth_error_response, bearer_token_from_headers, build_runtime_auth_service,
    format_ticket_expiration, parse_ws_origin_allowlist, request_id_from_headers,
    unix_timestamp_seconds, validate_runtime_auth_env, AuthContext, AuthMetrics,
    AuthMetricsSnapshot, AuthService, AuthenticatedPrincipal, FixedWindowRateLimiter,
    WsOriginAllowlist, WsTicketStore, DEFAULT_WS_ALLOWED_ORIGINS,
};
use authz::{
    authz_error_response, build_runtime_authorizer, Authorizer, AuthzAction,
    AuthzCacheInvalidationEvent, AuthzCacheInvalidationEventKind, AuthzCheckInput, AuthzErrorKind,
    AuthzMetrics, AuthzMetricsSnapshot, AuthzResource,
};
use axum::{
    body::Body,
    extract::{
        rejection::{JsonRejection, QueryRejection},
        ws::{CloseFrame, Message, WebSocket, WebSocketUpgrade},
        Extension, Path, Query, State,
    },
    http::{
        header::{ACCEPT, AUTHORIZATION, CONTENT_TYPE, ORIGIN, RETRY_AFTER},
        HeaderMap, HeaderName, HeaderValue, Method, Request, StatusCode,
    },
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{get, patch, post, put},
    Json, Router,
};
use dm::{build_runtime_dm_service, dm_error_response, DmService};
use guild_channel::{
    build_runtime_guild_channel_service, guild_channel_error_response, GuildChannelError,
    GuildChannelService,
};
use invite::{build_runtime_invite_service, invite_error_response, InviteService};
use linklynx_message_api::{
    CreateGuildChannelMessageRequestV1, DeleteGuildChannelMessageRequestV1,
    EditGuildChannelMessageRequestV1, ListGuildChannelMessagesQueryV1,
};
use linklynx_protocol_ws::{
    ClientMessageFrameV1, DmChannelSubscriptionTargetV1, DmMessageSubscriptionStateV1,
    GuildChannelSubscriptionTargetV1, MessageSubscriptionStateV1, ServerMessageFrameV1,
};
use message::{
    build_runtime_message_service, message_error_response, MessageError, MessageService,
};
use moderation::{
    build_runtime_moderation_service, moderation_error_response, ModerationError, ModerationService,
};
use profile::{
    build_runtime_profile_media_service, build_runtime_profile_service, profile_error_response,
    ProfileError, ProfileMediaService, ProfilePatchInput, ProfileService,
};
use ratelimit::{
    build_runtime_rest_rate_limit_service, rest_rate_limit_action_for_request, RestRateLimitAction,
    RestRateLimitService,
};
use scylla_health::{build_runtime_scylla_health_reporter, ScyllaHealthReporter};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tokio::sync::{OwnedSemaphorePermit, Semaphore};
use tower_http::cors::{AllowOrigin, CorsLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use user_directory::{
    build_runtime_user_directory_service, user_directory_error_response, UserDirectoryError,
    UserDirectoryService,
};

#[derive(Clone)]
pub(crate) struct AppState {
    auth_service: Arc<AuthService>,
    authorizer: Arc<dyn Authorizer>,
    authz_metrics: Arc<AuthzMetrics>,
    internal_ops_guard: Arc<InternalOpsGuard>,
    guild_channel_service: Arc<dyn GuildChannelService>,
    dm_service: Arc<dyn DmService>,
    invite_service: Arc<dyn InviteService>,
    message_service: Arc<dyn MessageService>,
    message_realtime_hub: Arc<MessageRealtimeHub>,
    moderation_service: Arc<dyn ModerationService>,
    profile_service: Arc<dyn ProfileService>,
    profile_media_service: Arc<dyn ProfileMediaService>,
    user_directory_service: Arc<dyn UserDirectoryService>,
    scylla_health_reporter: Arc<dyn ScyllaHealthReporter>,
    ws_reauth_grace: Duration,
    ws_ticket_ttl: Duration,
    auth_identify_timeout: Duration,
    ws_ticket_store: Arc<WsTicketStore>,
    ws_ticket_rate_limiter: Arc<FixedWindowRateLimiter>,
    ws_identify_rate_limiter: Arc<FixedWindowRateLimiter>,
    auth_attempt_rate_limiter: Arc<FixedWindowRateLimiter>,
    ws_origin_allowlist: Arc<WsOriginAllowlist>,
    http_allowed_origins: Arc<Vec<HeaderValue>>,
    ws_query_ticket_enabled: bool,
    ws_preauth_message_max_bytes: usize,
    ws_preauth_limit: usize,
    ws_preauth_connections: Arc<Semaphore>,
    public_invite_trusted_proxy_shared_secret: Option<String>,
    rest_rate_limit_service: Arc<RestRateLimitService>,
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

    let app = app().await;

    let addr = server_addr();
    tracing::info!(address = %addr, "server starting");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await?;
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
async fn build_runtime_state() -> AppState {
    let metrics = Arc::new(AuthMetrics::default());
    let auth_service = Arc::new(build_runtime_auth_service(Arc::clone(&metrics)));
    let authorizer = build_runtime_authorizer();
    let authz_metrics = Arc::new(AuthzMetrics::default());
    let guild_channel_service = build_runtime_guild_channel_service();
    let message_service = build_runtime_message_service().await;
    let dm_service = build_runtime_dm_service(Arc::clone(&message_service));
    let invite_service = build_runtime_invite_service();
    let message_realtime_hub = Arc::new(MessageRealtimeHub::default());
    let moderation_service = build_runtime_moderation_service();
    let profile_service = build_runtime_profile_service();
    let profile_media_service = build_runtime_profile_media_service(Arc::clone(&profile_service));
    let user_directory_service = build_runtime_user_directory_service();
    let scylla_health_reporter = build_runtime_scylla_health_reporter().await;
    let ws_reauth_grace = Duration::from_secs(
        env::var("WS_REAUTH_GRACE_SECONDS")
            .ok()
            .and_then(|value| value.parse::<u64>().ok())
            .unwrap_or(30),
    );
    let ws_ticket_ttl = Duration::from_secs(parse_runtime_u64("WS_TICKET_TTL_SECONDS", 60));
    let auth_identify_timeout =
        Duration::from_secs(parse_runtime_u64("AUTH_IDENTIFY_TIMEOUT_SECONDS", 5));
    let ws_ticket_rate_limit_max =
        parse_runtime_u64("WS_TICKET_RATE_LIMIT_MAX_PER_MINUTE", 20).min(u32::MAX as u64) as u32;
    let ws_identify_rate_limit_max =
        parse_runtime_u64("WS_IDENTIFY_RATE_LIMIT_MAX_PER_MINUTE", 60).min(u32::MAX as u64) as u32;
    let auth_attempt_rate_limit_max =
        parse_runtime_u64("AUTH_ATTEMPT_RATE_LIMIT_MAX_PER_MINUTE", 20).min(u32::MAX as u64) as u32;
    let ws_preauth_message_max_bytes =
        parse_runtime_u64("WS_PREAUTH_MESSAGE_MAX_BYTES", 16 * 1024) as usize;
    let ws_preauth_limit = parse_runtime_u64("WS_PREAUTH_MAX_CONNECTIONS_PER_NODE", 100) as usize;

    AppState {
        auth_service,
        authorizer,
        authz_metrics,
        internal_ops_guard: Arc::new(build_runtime_internal_ops_guard()),
        guild_channel_service,
        dm_service,
        invite_service,
        message_service,
        message_realtime_hub,
        moderation_service,
        profile_service,
        profile_media_service,
        user_directory_service,
        scylla_health_reporter,
        ws_reauth_grace,
        ws_ticket_ttl,
        auth_identify_timeout,
        ws_ticket_store: Arc::new(WsTicketStore::default()),
        ws_ticket_rate_limiter: Arc::new(FixedWindowRateLimiter::new(
            ws_ticket_rate_limit_max,
            Duration::from_secs(60),
        )),
        ws_identify_rate_limiter: Arc::new(FixedWindowRateLimiter::new(
            ws_identify_rate_limit_max,
            Duration::from_secs(60),
        )),
        auth_attempt_rate_limiter: Arc::new(FixedWindowRateLimiter::new(
            auth_attempt_rate_limit_max,
            Duration::from_secs(60),
        )),
        ws_origin_allowlist: Arc::new(build_runtime_ws_origin_allowlist()),
        http_allowed_origins: Arc::new(build_runtime_http_allowed_origins()),
        ws_query_ticket_enabled: parse_runtime_bool("WS_QUERY_TICKET_ENABLED", false),
        ws_preauth_message_max_bytes,
        ws_preauth_limit,
        ws_preauth_connections: Arc::new(Semaphore::new(ws_preauth_limit)),
        public_invite_trusted_proxy_shared_secret:
            build_runtime_public_invite_trusted_proxy_shared_secret(),
        rest_rate_limit_service: Arc::new(build_runtime_rest_rate_limit_service()),
    }
}

fn parse_runtime_u64(name: &str, default: u64) -> u64 {
    match env::var(name) {
        Ok(value) => match value.parse::<u64>() {
            Ok(parsed) => parsed,
            Err(error) => {
                tracing::warn!(
                    env_var = %name,
                    value = %value,
                    reason = %error,
                    default = default,
                    "invalid runtime u64 env value; fallback to default"
                );
                default
            }
        },
        Err(_) => default,
    }
}

fn parse_runtime_bool(name: &str, default: bool) -> bool {
    match env::var(name) {
        Ok(value) => match value.trim().to_ascii_lowercase().as_str() {
            "1" | "true" | "yes" | "on" => true,
            "0" | "false" | "no" | "off" => false,
            _ => {
                tracing::warn!(
                    env_var = %name,
                    value = %value,
                    default = default,
                    "invalid runtime bool env value; fallback to default"
                );
                default
            }
        },
        Err(_) => default,
    }
}

fn build_runtime_http_allowed_origins() -> Vec<HeaderValue> {
    let raw =
        env::var("HTTP_ALLOWED_ORIGINS").unwrap_or_else(|_| DEFAULT_WS_ALLOWED_ORIGINS.to_owned());
    let parsed = parse_ws_origin_allowlist(&raw).unwrap_or_else(|error| {
        let fallback = parse_ws_origin_allowlist(DEFAULT_WS_ALLOWED_ORIGINS)
            .expect("default WS allowed origins must be valid");
        tracing::warn!(
            env_var = "HTTP_ALLOWED_ORIGINS",
            value = %raw,
            reason = %error,
            fallback = DEFAULT_WS_ALLOWED_ORIGINS,
            "invalid HTTP allowed origins env value; fallback to default"
        );
        fallback
    });

    parsed
        .into_iter()
        .filter_map(|origin| HeaderValue::from_str(&origin).ok())
        .collect()
}

fn build_http_cors_layer(allowed_origins: &[HeaderValue]) -> CorsLayer {
    CorsLayer::new()
        .allow_origin(AllowOrigin::list(allowed_origins.iter().cloned()))
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PATCH,
            Method::DELETE,
            Method::HEAD,
            Method::OPTIONS,
        ])
        .allow_headers([
            AUTHORIZATION,
            CONTENT_TYPE,
            ACCEPT,
            ORIGIN,
            HeaderName::from_static("x-request-id"),
        ])
}

fn stable_scope_hash(value: &str) -> String {
    let digest = Sha256::digest(value.as_bytes());
    format!("{digest:x}")
}

fn auth_attempt_rate_limit_key(headers: &HeaderMap, token: Option<&str>) -> String {
    let scope_source = token
        .map(stable_scope_hash)
        .or_else(|| {
            headers
                .get(AUTHORIZATION)
                .and_then(|value| value.to_str().ok())
                .map(stable_scope_hash)
        })
        .unwrap_or_else(|| "anonymous".to_owned());
    format!("auth_attempt:{scope_source}")
}

fn auth_error_counts_toward_attempt_limit(error: &auth::AuthError) -> bool {
    matches!(
        error.kind,
        auth::AuthErrorKind::InvalidToken | auth::AuthErrorKind::ExpiredToken
    )
}

async fn enforce_auth_attempt_rate_limit(
    state: &AppState,
    request_id: &str,
    rate_limit_key: &str,
) -> Option<Response> {
    let decision = state
        .auth_attempt_rate_limiter
        .check_and_record_with_retry_after(rate_limit_key)
        .await;
    if decision.allowed {
        return None;
    }

    state.auth_service.metrics().record_auth_attempt_limited();
    let retry_after_seconds = decision
        .retry_after
        .map(|value| value.as_secs().max(1))
        .unwrap_or(1);
    tracing::warn!(
        decision = "deny",
        request_id = %request_id,
        error_class = "rate_limited",
        reason = "auth_attempt_rate_limited",
        auth_attempt_key = %rate_limit_key,
        retry_after_seconds,
        "authentication attempt rejected by rate limit"
    );
    Some(rate_limit_error_response(
        "AUTH_RATE_LIMITED",
        "authentication rate limit exceeded",
        request_id.to_owned(),
        retry_after_seconds,
    ))
}

fn try_acquire_ws_preauth_permit(
    state: &AppState,
    request_id: &str,
) -> Option<OwnedSemaphorePermit> {
    match Arc::clone(&state.ws_preauth_connections).try_acquire_owned() {
        Ok(permit) => {
            state.auth_service.metrics().record_ws_preauth_open();
            Some(permit)
        }
        Err(_) => {
            state.auth_service.metrics().record_ws_preauth_rejected();
            tracing::warn!(
                decision = "deny",
                request_id = %request_id,
                error_class = "rate_limited",
                reason = "ws_preauth_connection_limited",
                connection_limit = state.ws_preauth_limit,
                "WS pre-auth connection rejected by cap"
            );
            None
        }
    }
}

fn build_runtime_ws_origin_allowlist() -> WsOriginAllowlist {
    let configured =
        env::var("WS_ALLOWED_ORIGINS").unwrap_or_else(|_| DEFAULT_WS_ALLOWED_ORIGINS.to_owned());
    match parse_ws_origin_allowlist(&configured) {
        Ok(origins) => WsOriginAllowlist::new(origins),
        Err(reason) => {
            tracing::warn!(
                env_var = "WS_ALLOWED_ORIGINS",
                reason = %reason,
                fallback = DEFAULT_WS_ALLOWED_ORIGINS,
                "invalid WS origin allowlist value; fallback to defaults"
            );
            let fallback = HashSet::from([
                "http://localhost:3000".to_owned(),
                "http://127.0.0.1:3000".to_owned(),
            ]);
            WsOriginAllowlist::new(fallback)
        }
    }
}

/// 実行時ルータを構築する。
/// @param なし
/// @returns APIルータ
/// @throws なし
async fn app() -> Router {
    app_with_state(build_runtime_state().await)
}

include!("main/http_routes.rs");
include!("main/realtime.rs");
include!("main/ws_routes.rs");
include!("main/tests.rs");
