use axum::body::HttpBody as _;
use axum::http::{
    header::{CONTENT_LENGTH, RETRY_AFTER, TRANSFER_ENCODING},
    StatusCode,
};
use tower_http::cors::AllowOrigin;

/// 状態付きルータを構築する。
/// @param state アプリケーション状態
/// @returns APIルータ
/// @throws なし
fn app_with_state(state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list(state.http_middleware.cors_allow_origins.clone()))
        .allow_methods(Any)
        .allow_headers(Any);

    let protected_routes = Router::new().route("/v1/protected/ping", get(protected_ping));
    #[cfg(test)]
    let protected_routes = protected_routes.route("/v1/protected/slow", get(protected_slow));

    let protected_routes = protected_routes.route_layer(middleware::from_fn_with_state(
        state.clone(),
        protected_auth_input_middleware,
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
    expires_at_epoch: u64,
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
        expires_at_epoch: auth_context.expires_at_epoch,
    })
}

#[cfg(test)]
/// テスト用に遅延応答を返す。
/// @param なし
/// @returns 遅延後の正常応答
/// @throws なし
async fn protected_slow() -> &'static str {
    tokio::time::sleep(Duration::from_millis(10)).await;
    "slow-ok"
}

/// 認証メトリクスを返す。
/// @param state アプリケーション状態
/// @returns 認証メトリクス
/// @throws なし
async fn auth_metrics_handler(State(state): State<AppState>) -> Json<AuthMetricsSnapshot> {
    Json(state.auth_service.metrics().snapshot())
}

#[derive(Debug, Serialize)]
struct InputLimitErrorBody {
    code: &'static str,
    message: &'static str,
    request_id: String,
}

/// 入力制限エラーレスポンスを返す。
/// @param request_id リクエスト追跡ID
/// @param code エラーコード
/// @param message エラーメッセージ
/// @param retry_after_seconds 再試行可能秒数
/// @returns 入力制限エラーレスポンス
/// @throws なし
fn input_limit_error_response(
    request_id: String,
    code: &'static str,
    message: &'static str,
    retry_after_seconds: u64,
) -> Response {
    let mut response = (
        StatusCode::TOO_MANY_REQUESTS,
        Json(InputLimitErrorBody {
            code,
            message,
            request_id,
        }),
    )
        .into_response();
    if let Ok(value) = retry_after_seconds.to_string().parse() {
        response.headers_mut().insert(RETRY_AFTER, value);
    }
    response
}

#[derive(Debug)]
enum InputLimitViolation {
    BodyTooLarge { content_length: u64 },
    InvalidContentLength,
    UnsupportedTransferEncoding,
    UnknownBodySize,
}

/// Body上限関連の入力制限を検証する。
/// @param request HTTPリクエスト
/// @param max_body_bytes 許可する最大Bodyバイト数
/// @returns 違反なしなら `Ok(())`
/// @throws なし
fn validate_body_limit(
    request: &Request<Body>,
    max_body_bytes: usize,
) -> Result<(), InputLimitViolation> {
    if request.headers().contains_key(TRANSFER_ENCODING) {
        return Err(InputLimitViolation::UnsupportedTransferEncoding);
    }

    let Some(content_length_raw) = request.headers().get(CONTENT_LENGTH) else {
        let body_size_hint = request.body().size_hint();
        return match body_size_hint.upper() {
            Some(upper) if upper <= max_body_bytes as u64 => Ok(()),
            Some(upper) => Err(InputLimitViolation::BodyTooLarge {
                content_length: upper,
            }),
            None => Err(InputLimitViolation::UnknownBodySize),
        };
    };
    let content_length = content_length_raw
        .to_str()
        .ok()
        .and_then(|raw| raw.parse::<u64>().ok())
        .ok_or(InputLimitViolation::InvalidContentLength)?;

    if content_length > max_body_bytes as u64 {
        return Err(InputLimitViolation::BodyTooLarge { content_length });
    }

    Ok(())
}

/// 保護対象HTTPミドルウェアを実行する。
/// @param state アプリケーション状態
/// @param request HTTPリクエスト
/// @param next 次のハンドラ
/// @returns 認証・入力制限適用後レスポンス
/// @throws なし
async fn protected_auth_input_middleware(
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

    request
        .extensions_mut()
        .insert(AuthContext::from_authenticated(request_id.clone(), &authenticated));

    if let Err(violation) = validate_body_limit(&request, state.http_middleware.body_limit_bytes) {
        let (code, message, reason, content_length) = match violation {
            InputLimitViolation::BodyTooLarge { content_length } => (
                "INPUT_LIMIT_BODY_TOO_LARGE",
                "request body exceeds allowed size",
                "request_body_too_large",
                Some(content_length),
            ),
            InputLimitViolation::InvalidContentLength => (
                "INPUT_LIMIT_CONTENT_LENGTH_INVALID",
                "content-length header is invalid",
                "content_length_invalid",
                None,
            ),
            InputLimitViolation::UnsupportedTransferEncoding => (
                "INPUT_LIMIT_TRANSFER_ENCODING_UNSUPPORTED",
                "transfer-encoding is not supported",
                "transfer_encoding_unsupported",
                None,
            ),
            InputLimitViolation::UnknownBodySize => (
                "INPUT_LIMIT_BODY_SIZE_UNKNOWN",
                "request body size must be bounded",
                "request_body_size_unknown",
                None,
            ),
        };
        tracing::warn!(
            decision = "deny",
            request_id = %request_id,
            content_length,
            body_limit = state.http_middleware.body_limit_bytes,
            error_class = "input_limit_body",
            reason,
            "HTTP request rejected by input limit"
        );
        return input_limit_error_response(
            request_id,
            code,
            message,
            state.http_middleware.retry_after_seconds,
        );
    }

    match tokio::time::timeout(state.http_middleware.request_timeout, next.run(request)).await {
        Ok(response) => response,
        Err(_) => {
            tracing::warn!(
                decision = "deny",
                request_id = %request_id,
                timeout_ms = state.http_middleware.request_timeout.as_millis(),
                error_class = "input_limit_timeout",
                reason = "request_timeout",
                "HTTP request rejected by timeout limit"
            );
            input_limit_error_response(
                request_id,
                "INPUT_LIMIT_TIMEOUT",
                "request processing timed out",
                state.http_middleware.retry_after_seconds,
            )
        }
    }
}
