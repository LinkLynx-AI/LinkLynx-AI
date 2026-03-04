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
        .route("/v1/protected/ping", get(protected_ping))
        .route("/internal/auth/metrics", get(auth_metrics_handler))
        .route("/guilds", get(list_guilds).post(create_guild))
        .route(
            "/guilds/{guild_id}/channels",
            get(list_guild_channels).post(create_guild_channel),
        )
        .route(
            "/users/me/profile",
            get(get_my_profile).patch(patch_my_profile),
        )
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
        .route("/auth/ws-ticket", post(issue_ws_ticket))
        .route("/internal/authz/metrics", get(authz_metrics_handler))
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

/// 認可メトリクスを返す。
/// @param state アプリケーション状態
/// @returns 認可メトリクス
/// @throws なし
async fn authz_metrics_handler(State(state): State<AppState>) -> Json<AuthzMetricsSnapshot> {
    Json(state.authz_metrics.snapshot())
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

#[derive(Debug, Serialize)]
struct ProfileResponse {
    profile: profile::ProfileSettings,
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

/// JSON入力を検証してプロフィール更新ペイロードを取得する。
/// @param payload JSON抽出結果
/// @returns 検証済みJSONペイロード
/// @throws ProfileError JSON不正時
fn parse_profile_patch_payload(
    payload: Result<Json<serde_json::Value>, JsonRejection>,
) -> Result<ProfilePatchInput, ProfileError> {
    let payload = payload
        .map(|Json(value)| value)
        .map_err(|_| ProfileError::validation("request_body_invalid"))?;
    let payload = payload
        .as_object()
        .ok_or_else(|| ProfileError::validation("request_body_invalid"))?;

    let display_name = parse_display_name_patch_field(payload)?;
    let status_text = parse_nullable_string_patch_field(payload, "status_text")?;
    let avatar_key = parse_nullable_string_patch_field(payload, "avatar_key")?;

    Ok(ProfilePatchInput {
        display_name,
        status_text,
        avatar_key,
    })
}

/// display_name更新フィールドを解釈する。
/// @param payload リクエストJSONオブジェクト
/// @returns display_name更新値
/// @throws ProfileError 型不正またはnull入力時
fn parse_display_name_patch_field(
    payload: &serde_json::Map<String, serde_json::Value>,
) -> Result<Option<String>, ProfileError> {
    match payload.get("display_name") {
        Some(serde_json::Value::String(value)) => Ok(Some(value.clone())),
        Some(serde_json::Value::Null) => {
            Err(ProfileError::validation("display_name_null_not_allowed"))
        }
        Some(_) => Err(ProfileError::validation("display_name_invalid_type")),
        None => Ok(None),
    }
}

/// nullable文字列更新フィールドを解釈する。
/// @param payload リクエストJSONオブジェクト
/// @param field_name 対象フィールド名
/// @returns 更新値（None=未指定、Some(None)=null指定、Some(Some)=文字列指定）
/// @throws ProfileError 型不正時
fn parse_nullable_string_patch_field(
    payload: &serde_json::Map<String, serde_json::Value>,
    field_name: &str,
) -> Result<Option<Option<String>>, ProfileError> {
    match payload.get(field_name) {
        Some(serde_json::Value::String(value)) => Ok(Some(Some(value.clone()))),
        Some(serde_json::Value::Null) => Ok(Some(None)),
        Some(_) => Err(ProfileError::validation(format!("{field_name}_invalid_type"))),
        None => Ok(None),
    }
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

/// 認証済みprincipalのプロフィールを返す。
/// @param state アプリケーション状態
/// @param auth_context 認証文脈
/// @returns プロフィールレスポンス
/// @throws なし
async fn get_my_profile(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
) -> Response {
    let request_id = auth_context.request_id.clone();

    match state.profile_service.get_profile(auth_context.principal_id).await {
        Ok(profile) => Json(ProfileResponse { profile }).into_response(),
        Err(error) => profile_error_response(&error, request_id),
    }
}

/// 認証済みprincipalのプロフィールを更新する。
/// @param state アプリケーション状態
/// @param auth_context 認証文脈
/// @param payload 更新入力
/// @returns 更新後プロフィールレスポンス
/// @throws なし
async fn patch_my_profile(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    payload: Result<Json<serde_json::Value>, JsonRejection>,
) -> Response {
    let request_id = auth_context.request_id.clone();
    let patch = match parse_profile_patch_payload(payload) {
        Ok(value) => value,
        Err(error) => return profile_error_response(&error, request_id),
    };

    match state
        .profile_service
        .update_profile(auth_context.principal_id, patch)
        .await
    {
        Ok(profile) => Json(ProfileResponse { profile }).into_response(),
        Err(error) => profile_error_response(&error, request_id),
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
        state.authz_metrics.record_error(&error);
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
    state.authz_metrics.record_allow();

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
