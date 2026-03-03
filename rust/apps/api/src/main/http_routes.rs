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
        .route("/protected/ping", get(protected_ping))
        .route("/guilds", get(list_guilds).post(create_guild))
        .route(
            "/guilds/{guild_id}/channels",
            get(list_guild_channels).post(create_guild_channel),
        )
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            rest_auth_middleware,
        ));

    Router::new()
        .route("/", get(root))
        .route("/health", get(health_check))
        .route("/ws", get(ws_handler))
        .route("/auth/ws-ticket", post(issue_ws_ticket))
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

#[derive(Debug, Serialize)]
struct WsTicketResponse {
    ticket: String,
    #[serde(rename = "expiresAt")]
    expires_at: String,
}

#[derive(Debug, Serialize)]
struct ApiErrorResponse {
    code: &'static str,
    message: &'static str,
    request_id: String,
}

/// WS identify用ワンタイムチケットを発行する。
/// @param state アプリケーション状態
/// @param headers HTTPヘッダー
/// @returns 発行済みWSチケット
/// @throws なし
async fn issue_ws_ticket(State(state): State<AppState>, headers: HeaderMap) -> Response {
    let request_id = request_id_from_headers(&headers);
    let token = match bearer_token_from_headers(&headers) {
        Ok(token) => token,
        Err(error) => {
            tracing::warn!(
                decision = %error.decision(),
                request_id = %request_id,
                error_class = %error.log_class(),
                reason = %error.reason,
                "WS ticket issuance rejected at header parsing"
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
                "WS ticket issuance rejected at authentication"
            );
            return auth_error_response(&error, request_id);
        }
    };

    let rate_limit_key = format!("principal:{}", authenticated.principal_id.0);
    if !state
        .ws_ticket_rate_limiter
        .check_and_record(&rate_limit_key)
        .await
    {
        tracing::warn!(
            decision = "deny",
            request_id = %request_id,
            principal_id = authenticated.principal_id.0,
            error_class = "rate_limited",
            reason = "ws_ticket_rate_limited",
            "WS ticket issuance rejected by rate limit"
        );
        let body = ApiErrorResponse {
            code: "AUTH_RATE_LIMITED",
            message: "authentication rate limit exceeded",
            request_id,
        };
        return (StatusCode::TOO_MANY_REQUESTS, Json(body)).into_response();
    }

    let authz_input = AuthzCheckInput {
        principal_id: authenticated.principal_id,
        resource: AuthzResource::Session,
        action: AuthzAction::Connect,
    };
    if let Err(error) = state.authorizer.check(&authz_input).await {
        tracing::warn!(
            decision = %error.decision(),
            request_id = %request_id,
            principal_id = authenticated.principal_id.0,
            error_class = %error.log_class(),
            reason = %error.reason,
            resource = "session",
            action = "connect",
            decision_source = "authorizer",
            "WS ticket issuance rejected by authz"
        );
        return authz_error_response(&error, request_id);
    }

    let issued = state
        .ws_ticket_store
        .issue_ticket(authenticated, state.ws_ticket_ttl)
        .await;
    let body = WsTicketResponse {
        ticket: issued.ticket,
        expires_at: format_ticket_expiration(issued.expires_at_epoch),
    };

    Json(body).into_response()
}

#[derive(Debug, Serialize)]
struct GuildListResponse {
    guilds: Vec<guild_channel::GuildSummary>,
}

#[derive(Debug, Deserialize)]
struct CreateGuildRequest {
    name: String,
}

#[derive(Debug, Serialize)]
struct GuildCreateResponse {
    guild: guild_channel::CreatedGuild,
}

#[derive(Debug, Deserialize)]
struct GuildPathParams {
    guild_id: String,
}

#[derive(Debug, Serialize)]
struct ChannelListResponse {
    channels: Vec<guild_channel::ChannelSummary>,
}

#[derive(Debug, Deserialize)]
struct CreateChannelRequest {
    name: String,
}

#[derive(Debug, Serialize)]
struct ChannelCreateResponse {
    channel: guild_channel::CreatedChannel,
}

/// guild_idパスパラメータを検証する。
/// @param raw_guild_id 生のguild_id文字列
/// @returns 検証済みguild_id
/// @throws GuildChannelError パラメータ不正時
fn parse_guild_id(raw_guild_id: &str) -> Result<i64, GuildChannelError> {
    let parsed = raw_guild_id
        .parse::<i64>()
        .map_err(|_| GuildChannelError::validation("guild_id_invalid"))?;
    if parsed <= 0 {
        return Err(GuildChannelError::validation("guild_id_must_be_positive"));
    }

    Ok(parsed)
}

/// JSON入力を検証してペイロードを取得する。
/// @param payload JSON抽出結果
/// @returns 検証済みJSONペイロード
/// @throws GuildChannelError JSON不正時
fn parse_json_payload<T>(payload: Result<Json<T>, JsonRejection>) -> Result<T, GuildChannelError> {
    payload
        .map(|Json(value)| value)
        .map_err(|_| GuildChannelError::validation("request_body_invalid"))
}

/// principalが所属するguild一覧を返す。
/// @param state アプリケーション状態
/// @param auth_context 認証文脈
/// @returns guild一覧レスポンス
/// @throws なし
async fn list_guilds(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
) -> Response {
    let request_id = auth_context.request_id.clone();

    match state
        .guild_channel_service
        .list_guilds(auth_context.principal_id)
        .await
    {
        Ok(guilds) => Json(GuildListResponse { guilds }).into_response(),
        Err(error) => guild_channel_error_response(&error, request_id),
    }
}

/// guildを作成してowner bootstrapを実行する。
/// @param state アプリケーション状態
/// @param auth_context 認証文脈
/// @param payload 作成入力
/// @returns 作成結果レスポンス
/// @throws なし
async fn create_guild(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    payload: Result<Json<CreateGuildRequest>, JsonRejection>,
) -> Response {
    let request_id = auth_context.request_id.clone();
    let payload = match parse_json_payload(payload) {
        Ok(value) => value,
        Err(error) => return guild_channel_error_response(&error, request_id),
    };

    match state
        .guild_channel_service
        .create_guild(auth_context.principal_id, payload.name)
        .await
    {
        Ok(guild) => (StatusCode::CREATED, Json(GuildCreateResponse { guild })).into_response(),
        Err(error) => guild_channel_error_response(&error, request_id),
    }
}

/// guild配下のchannel一覧を返す。
/// @param state アプリケーション状態
/// @param auth_context 認証文脈
/// @param params パスパラメータ
/// @returns channel一覧レスポンス
/// @throws なし
async fn list_guild_channels(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(params): Path<GuildPathParams>,
) -> Response {
    let request_id = auth_context.request_id.clone();
    let guild_id = match parse_guild_id(&params.guild_id) {
        Ok(value) => value,
        Err(error) => return guild_channel_error_response(&error, request_id),
    };

    match state
        .guild_channel_service
        .list_guild_channels(auth_context.principal_id, guild_id)
        .await
    {
        Ok(channels) => Json(ChannelListResponse { channels }).into_response(),
        Err(error) => guild_channel_error_response(&error, request_id),
    }
}

/// guild配下へchannelを作成する。
/// @param state アプリケーション状態
/// @param auth_context 認証文脈
/// @param params パスパラメータ
/// @param payload 作成入力
/// @returns 作成結果レスポンス
/// @throws なし
async fn create_guild_channel(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(params): Path<GuildPathParams>,
    payload: Result<Json<CreateChannelRequest>, JsonRejection>,
) -> Response {
    let request_id = auth_context.request_id.clone();
    let guild_id = match parse_guild_id(&params.guild_id) {
        Ok(value) => value,
        Err(error) => return guild_channel_error_response(&error, request_id),
    };
    let payload = match parse_json_payload(payload) {
        Ok(value) => value,
        Err(error) => return guild_channel_error_response(&error, request_id),
    };

    match state
        .guild_channel_service
        .create_guild_channel(auth_context.principal_id, guild_id, payload.name)
        .await
    {
        Ok(channel) => (StatusCode::CREATED, Json(ChannelCreateResponse { channel })).into_response(),
        Err(error) => guild_channel_error_response(&error, request_id),
    }
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
    let request_method = request.method().clone();
    let request_path = request.uri().path().to_owned();

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
        email_verified = true,
        "REST auth accepted"
    );

    let action = match request_method {
        axum::http::Method::GET | axum::http::Method::HEAD => AuthzAction::View,
        axum::http::Method::POST => AuthzAction::Post,
        _ => AuthzAction::Manage,
    };
    let action_label = match action {
        AuthzAction::Connect => "connect",
        AuthzAction::View => "view",
        AuthzAction::Post => "post",
        AuthzAction::Manage => "manage",
    };
    let authz_input = AuthzCheckInput {
        principal_id: authenticated.principal_id,
        resource: AuthzResource::RestPath {
            path: request_path.clone(),
        },
        action,
    };
    if let Err(error) = state.authorizer.check(&authz_input).await {
        tracing::warn!(
            decision = %error.decision(),
            request_id = %request_id,
            principal_id = authenticated.principal_id.0,
            error_class = %error.log_class(),
            reason = %error.reason,
            resource = %request_path,
            action = action_label,
            decision_source = "authorizer",
            "REST authz rejected"
        );
        return authz_error_response(&error, request_id);
    }

    request.extensions_mut().insert(AuthContext {
        request_id,
        principal_id: authenticated.principal_id,
        firebase_uid: authenticated.firebase_uid,
    });

    next.run(request).await
}
