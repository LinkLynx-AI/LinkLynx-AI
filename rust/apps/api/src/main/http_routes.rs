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
        .route("/v1/guilds/{guild_id}", get(get_guild))
        .route("/v1/guilds/{guild_id}", axum::routing::patch(update_guild))
        .route(
            "/v1/guilds/{guild_id}/invites/{invite_code}",
            get(get_guild_invite),
        )
        .route(
            "/v1/guilds/{guild_id}/channels/{channel_id}",
            get(get_guild_channel),
        )
        .route(
            "/v1/guilds/{guild_id}/channels/{channel_id}/messages",
            get(list_channel_messages),
        )
        .route(
            "/v1/guilds/{guild_id}/channels/{channel_id}/messages",
            axum::routing::post(create_channel_message),
        )
        .route("/v1/dms/{channel_id}", get(get_dm_channel))
        .route("/v1/dms/{channel_id}/messages", get(list_dm_messages))
        .route(
            "/v1/dms/{channel_id}/messages",
            axum::routing::post(create_dm_message),
        )
        .route(
            "/v1/moderation/guilds/{guild_id}/members/{member_id}",
            axum::routing::patch(moderate_guild_member),
        )
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

#[derive(Debug, Serialize)]
struct GuildResponse {
    ok: bool,
    request_id: String,
    principal_id: i64,
    guild_id: i64,
}

#[derive(Debug, Serialize)]
struct GuildChannelResponse {
    ok: bool,
    request_id: String,
    principal_id: i64,
    guild_id: i64,
    channel_id: i64,
}

#[derive(Debug, Serialize)]
struct GuildChannelMessagesResponse {
    ok: bool,
    request_id: String,
    principal_id: i64,
    guild_id: i64,
    channel_id: i64,
    messages: Vec<String>,
}

#[derive(Debug, Serialize)]
struct GuildChannelMessageCreateResponse {
    ok: bool,
    request_id: String,
    principal_id: i64,
    guild_id: i64,
    channel_id: i64,
    message_id: String,
}

#[derive(Debug, Serialize)]
struct GuildInviteResponse {
    ok: bool,
    request_id: String,
    principal_id: i64,
    guild_id: i64,
    invite_code: String,
}

#[derive(Debug, Serialize)]
struct DmChannelResponse {
    ok: bool,
    request_id: String,
    principal_id: i64,
    channel_id: i64,
}

#[derive(Debug, Serialize)]
struct DmMessagesResponse {
    ok: bool,
    request_id: String,
    principal_id: i64,
    channel_id: i64,
    messages: Vec<String>,
}

#[derive(Debug, Serialize)]
struct DmMessageCreateResponse {
    ok: bool,
    request_id: String,
    principal_id: i64,
    channel_id: i64,
    message_id: String,
}

#[derive(Debug, Serialize)]
struct ModerationActionResponse {
    ok: bool,
    request_id: String,
    principal_id: i64,
    guild_id: i64,
    member_id: i64,
    action: String,
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

/// ギルド情報の最小応答を返す。
/// @param path guild_id を含むパス
/// @param auth_context 認証文脈
/// @returns ギルド最小応答
/// @throws なし
async fn get_guild(
    axum::extract::Path(guild_id): axum::extract::Path<i64>,
    Extension(auth_context): Extension<AuthContext>,
) -> Json<GuildResponse> {
    Json(GuildResponse {
        ok: true,
        request_id: auth_context.request_id,
        principal_id: auth_context.principal_id.0,
        guild_id,
    })
}

/// ギルド更新の最小応答を返す。
/// @param path guild_id を含むパス
/// @param auth_context 認証文脈
/// @returns ギルド更新最小応答
/// @throws なし
async fn update_guild(
    axum::extract::Path(guild_id): axum::extract::Path<i64>,
    Extension(auth_context): Extension<AuthContext>,
) -> Json<GuildResponse> {
    Json(GuildResponse {
        ok: true,
        request_id: auth_context.request_id,
        principal_id: auth_context.principal_id.0,
        guild_id,
    })
}

/// ギルド招待情報の最小応答を返す。
/// @param path guild_id と invite_code を含むパス
/// @param auth_context 認証文脈
/// @returns 招待情報最小応答
/// @throws なし
async fn get_guild_invite(
    axum::extract::Path((guild_id, invite_code)): axum::extract::Path<(i64, String)>,
    Extension(auth_context): Extension<AuthContext>,
) -> Json<GuildInviteResponse> {
    Json(GuildInviteResponse {
        ok: true,
        request_id: auth_context.request_id,
        principal_id: auth_context.principal_id.0,
        guild_id,
        invite_code,
    })
}

/// ギルドチャンネル情報の最小応答を返す。
/// @param path guild_id と channel_id を含むパス
/// @param auth_context 認証文脈
/// @returns チャンネル最小応答
/// @throws なし
async fn get_guild_channel(
    axum::extract::Path((guild_id, channel_id)): axum::extract::Path<(i64, i64)>,
    Extension(auth_context): Extension<AuthContext>,
) -> Json<GuildChannelResponse> {
    Json(GuildChannelResponse {
        ok: true,
        request_id: auth_context.request_id,
        principal_id: auth_context.principal_id.0,
        guild_id,
        channel_id,
    })
}

/// チャンネルメッセージ一覧の最小応答を返す。
/// @param path guild_id と channel_id を含むパス
/// @param auth_context 認証文脈
/// @returns メッセージ一覧最小応答
/// @throws なし
async fn list_channel_messages(
    axum::extract::Path((guild_id, channel_id)): axum::extract::Path<(i64, i64)>,
    Extension(auth_context): Extension<AuthContext>,
) -> Json<GuildChannelMessagesResponse> {
    Json(GuildChannelMessagesResponse {
        ok: true,
        request_id: auth_context.request_id,
        principal_id: auth_context.principal_id.0,
        guild_id,
        channel_id,
        messages: Vec::new(),
    })
}

/// チャンネルメッセージ作成の最小応答を返す。
/// @param path guild_id と channel_id を含むパス
/// @param auth_context 認証文脈
/// @returns メッセージ作成最小応答
/// @throws なし
async fn create_channel_message(
    axum::extract::Path((guild_id, channel_id)): axum::extract::Path<(i64, i64)>,
    Extension(auth_context): Extension<AuthContext>,
) -> Json<GuildChannelMessageCreateResponse> {
    Json(GuildChannelMessageCreateResponse {
        ok: true,
        request_id: auth_context.request_id,
        principal_id: auth_context.principal_id.0,
        guild_id,
        channel_id,
        message_id: format!("msg-{guild_id}-{channel_id}"),
    })
}

/// DMチャンネル情報の最小応答を返す。
/// @param path channel_id を含むパス
/// @param auth_context 認証文脈
/// @returns DMチャンネル最小応答
/// @throws なし
async fn get_dm_channel(
    axum::extract::Path(channel_id): axum::extract::Path<i64>,
    Extension(auth_context): Extension<AuthContext>,
) -> Json<DmChannelResponse> {
    Json(DmChannelResponse {
        ok: true,
        request_id: auth_context.request_id,
        principal_id: auth_context.principal_id.0,
        channel_id,
    })
}

/// DMメッセージ一覧の最小応答を返す。
/// @param path channel_id を含むパス
/// @param auth_context 認証文脈
/// @returns DMメッセージ一覧最小応答
/// @throws なし
async fn list_dm_messages(
    axum::extract::Path(channel_id): axum::extract::Path<i64>,
    Extension(auth_context): Extension<AuthContext>,
) -> Json<DmMessagesResponse> {
    Json(DmMessagesResponse {
        ok: true,
        request_id: auth_context.request_id,
        principal_id: auth_context.principal_id.0,
        channel_id,
        messages: Vec::new(),
    })
}

/// DMメッセージ作成の最小応答を返す。
/// @param path channel_id を含むパス
/// @param auth_context 認証文脈
/// @returns DMメッセージ作成最小応答
/// @throws なし
async fn create_dm_message(
    axum::extract::Path(channel_id): axum::extract::Path<i64>,
    Extension(auth_context): Extension<AuthContext>,
) -> Json<DmMessageCreateResponse> {
    Json(DmMessageCreateResponse {
        ok: true,
        request_id: auth_context.request_id,
        principal_id: auth_context.principal_id.0,
        channel_id,
        message_id: format!("dm-msg-{channel_id}"),
    })
}

/// モデレーション操作の最小応答を返す。
/// @param path guild_id と member_id を含むパス
/// @param auth_context 認証文脈
/// @returns モデレーション最小応答
/// @throws なし
async fn moderate_guild_member(
    axum::extract::Path((guild_id, member_id)): axum::extract::Path<(i64, i64)>,
    Extension(auth_context): Extension<AuthContext>,
) -> Json<ModerationActionResponse> {
    Json(ModerationActionResponse {
        ok: true,
        request_id: auth_context.request_id,
        principal_id: auth_context.principal_id.0,
        guild_id,
        member_id,
        action: "moderate_member".to_owned(),
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

    let action = rest_authz_action_from_method(&request_method);
    let action_label = match action {
        AuthzAction::Connect => "connect",
        AuthzAction::View => "view",
        AuthzAction::Post => "post",
        AuthzAction::Manage => "manage",
    };
    let authz_input = AuthzCheckInput {
        principal_id: authenticated.principal_id,
        resource: rest_authz_resource_from_path(&request_path),
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

/// RESTメソッドから AuthZ action を決定する。
/// @param method HTTP メソッド
/// @returns AuthZ action
/// @throws なし
fn rest_authz_action_from_method(method: &axum::http::Method) -> AuthzAction {
    match method {
        &axum::http::Method::GET | &axum::http::Method::HEAD => AuthzAction::View,
        &axum::http::Method::POST => AuthzAction::Post,
        _ => AuthzAction::Manage,
    }
}

/// RESTパスから AuthZ resource を決定する。
/// @param path リクエストパス
/// @returns AuthZ resource
/// @throws なし
fn rest_authz_resource_from_path(path: &str) -> AuthzResource {
    if let Some((guild_id, channel_id)) = parse_guild_channel_path(path) {
        return AuthzResource::GuildChannel {
            guild_id,
            channel_id,
        };
    }
    if let Some(channel_id) = parse_dm_channel_path(path) {
        return AuthzResource::Channel { channel_id };
    }
    if let Some(guild_id) = parse_guild_invite_path(path) {
        return AuthzResource::Guild { guild_id };
    }
    if let Some(guild_id) = parse_moderation_guild_path(path) {
        return AuthzResource::Guild { guild_id };
    }
    if let Some(guild_id) = parse_guild_path(path) {
        return AuthzResource::Guild { guild_id };
    }
    AuthzResource::RestPath {
        path: path.to_owned(),
    }
}

/// ギルドパスから guild_id を抽出する。
/// @param path リクエストパス
/// @returns guild_id
/// @throws なし
fn parse_guild_path(path: &str) -> Option<i64> {
    let segments = path
        .trim_matches('/')
        .split('/')
        .collect::<Vec<_>>();
    if segments.len() != 3 {
        return None;
    }
    if segments[0] != "v1" || segments[1] != "guilds" {
        return None;
    }
    segments[2].parse::<i64>().ok()
}

/// ギルドチャンネルパスから guild_id/channel_id を抽出する。
/// @param path リクエストパス
/// @returns guild_id と channel_id
/// @throws なし
fn parse_guild_channel_path(path: &str) -> Option<(i64, i64)> {
    let segments = path
        .trim_matches('/')
        .split('/')
        .collect::<Vec<_>>();
    if segments.len() < 5 {
        return None;
    }
    if segments[0] != "v1" || segments[1] != "guilds" || segments[3] != "channels" {
        return None;
    }
    let guild_id = segments[2].parse::<i64>().ok()?;
    let channel_id = segments[4].parse::<i64>().ok()?;
    Some((guild_id, channel_id))
}

/// ギルド招待パスから guild_id を抽出する。
/// @param path リクエストパス
/// @returns guild_id
/// @throws なし
fn parse_guild_invite_path(path: &str) -> Option<i64> {
    let segments = path.trim_matches('/').split('/').collect::<Vec<_>>();
    if segments.len() != 5 {
        return None;
    }
    if segments[0] != "v1" || segments[1] != "guilds" || segments[3] != "invites" {
        return None;
    }
    segments[2].parse::<i64>().ok()
}

/// DMパスから channel_id を抽出する。
/// @param path リクエストパス
/// @returns channel_id
/// @throws なし
fn parse_dm_channel_path(path: &str) -> Option<i64> {
    let segments = path.trim_matches('/').split('/').collect::<Vec<_>>();
    if segments.len() < 3 {
        return None;
    }
    if segments[0] != "v1" || segments[1] != "dms" {
        return None;
    }
    segments[2].parse::<i64>().ok()
}

/// モデレーションパスから guild_id を抽出する。
/// @param path リクエストパス
/// @returns guild_id
/// @throws なし
fn parse_moderation_guild_path(path: &str) -> Option<i64> {
    let segments = path.trim_matches('/').split('/').collect::<Vec<_>>();
    if segments.len() < 4 {
        return None;
    }
    if segments[0] != "v1" || segments[1] != "moderation" || segments[2] != "guilds" {
        return None;
    }
    segments[3].parse::<i64>().ok()
}
