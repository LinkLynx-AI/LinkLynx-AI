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
        .route("/internal/authz/metrics", get(authz_metrics_handler))
        .route(
            "/internal/authz/cache/invalidate",
            post(authz_cache_invalidate_handler),
        )
        .route("/guilds", get(list_guilds).post(create_guild))
        .route("/guilds/{guild_id}", patch(patch_guild).delete(delete_guild))
        .route(
            "/guilds/{guild_id}/channels",
            get(list_guild_channels).post(create_guild_channel),
        )
        .route(
            "/channels/{channel_id}",
            patch(update_guild_channel).delete(delete_guild_channel),
        )
        .route(
            "/guilds/{guild_id}/moderation/reports",
            get(list_moderation_reports).post(create_moderation_report),
        )
        .route(
            "/guilds/{guild_id}/moderation/mutes",
            post(create_moderation_mute),
        )
        .route(
            "/guilds/{guild_id}/moderation/reports/{report_id}",
            get(get_moderation_report),
        )
        .route(
            "/guilds/{guild_id}/moderation/reports/{report_id}/resolve",
            post(resolve_moderation_report),
        )
        .route(
            "/guilds/{guild_id}/moderation/reports/{report_id}/reopen",
            post(reopen_moderation_report),
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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
struct AuthzCacheInvalidationRequest {
    kind: String,
    guild_id: Option<i64>,
    channel_id: Option<i64>,
    user_id: Option<i64>,
    policy_version: Option<String>,
    occurred_at_unix_ms: Option<u64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AuthzCacheInvalidationResponse {
    evicted_keys: u64,
    lag_ms: u64,
    events_total: u64,
    evicted_keys_total: u64,
    last_lag_ms: u64,
}

/// 認可キャッシュ invalidation イベントを適用する。
/// @param state アプリケーション状態
/// @param auth_context 認証文脈
/// @param payload invalidationイベント入力
/// @returns invalidation適用結果
/// @throws なし
async fn authz_cache_invalidate_handler(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    payload: Result<Json<AuthzCacheInvalidationRequest>, JsonRejection>,
) -> Response {
    let request_id = auth_context.request_id;
    let payload = match payload {
        Ok(Json(value)) => value,
        Err(_) => {
            let body = ApiErrorResponse {
                code: "AUTHZ_CACHE_INVALIDATION_INVALID",
                message: "invalidation payload is invalid",
                request_id,
            };
            return (StatusCode::BAD_REQUEST, Json(body)).into_response();
        }
    };

    let event = match build_authz_cache_invalidation_event(payload) {
        Ok(value) => value,
        Err(reason) => {
            let body = ApiErrorResponse {
                code: "AUTHZ_CACHE_INVALIDATION_INVALID",
                message: reason,
                request_id,
            };
            return (StatusCode::BAD_REQUEST, Json(body)).into_response();
        }
    };

    let report = state.authorizer.invalidate_cache(&event).await;
    let metrics = state.authorizer.cache_invalidation_metrics();

    Json(AuthzCacheInvalidationResponse {
        evicted_keys: report.evicted_keys,
        lag_ms: report.lag_ms,
        events_total: metrics.events_total,
        evicted_keys_total: metrics.evicted_keys_total,
        last_lag_ms: metrics.last_lag_ms,
    })
    .into_response()
}

/// invalidation入力をAuthZイベントへ変換する。
/// @param payload invalidation入力
/// @returns AuthZ invalidationイベント
/// @throws &'static str 必須フィールド不備時
fn build_authz_cache_invalidation_event(
    payload: AuthzCacheInvalidationRequest,
) -> Result<AuthzCacheInvalidationEvent, &'static str> {
    let kind = match payload.kind.as_str() {
        "guild_role_changed" => AuthzCacheInvalidationEventKind::GuildRoleChanged {
            guild_id: payload.guild_id.ok_or("guild_id is required")?,
        },
        "guild_member_role_changed" => AuthzCacheInvalidationEventKind::GuildMemberRoleChanged {
            guild_id: payload.guild_id.ok_or("guild_id is required")?,
            user_id: payload.user_id.ok_or("user_id is required")?,
        },
        "channel_role_override_changed" => AuthzCacheInvalidationEventKind::ChannelRoleOverrideChanged {
            guild_id: payload.guild_id.ok_or("guild_id is required")?,
            channel_id: payload.channel_id.ok_or("channel_id is required")?,
        },
        "channel_user_override_changed" => AuthzCacheInvalidationEventKind::ChannelUserOverrideChanged {
            guild_id: payload.guild_id.ok_or("guild_id is required")?,
            channel_id: payload.channel_id.ok_or("channel_id is required")?,
            user_id: payload.user_id.ok_or("user_id is required")?,
        },
        "policy_version_changed" => AuthzCacheInvalidationEventKind::PolicyVersionChanged {
            policy_version: payload
                .policy_version
                .as_ref()
                .map(|value| value.trim())
                .filter(|value| !value.is_empty())
                .ok_or("policy_version is required")?
                .to_owned(),
        },
        "all" => AuthzCacheInvalidationEventKind::All,
        _ => return Err("kind is invalid"),
    };

    let occurred_at = payload
        .occurred_at_unix_ms
        .map(|unix_ms| std::time::UNIX_EPOCH + Duration::from_millis(unix_ms))
        .unwrap_or_else(std::time::SystemTime::now);

    Ok(AuthzCacheInvalidationEvent { kind, occurred_at })
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

/// レート制限エラー応答を生成する。
/// @param code エラーコード
/// @param message エラーメッセージ
/// @param request_id リクエストID
/// @param retry_after_seconds Retry-After秒
/// @returns RESTエラーレスポンス
/// @throws なし
fn rate_limit_error_response(
    code: &'static str,
    message: &'static str,
    request_id: String,
    retry_after_seconds: u64,
) -> Response {
    let body = ApiErrorResponse {
        code,
        message,
        request_id,
    };
    let mut response = (StatusCode::TOO_MANY_REQUESTS, Json(body)).into_response();
    if let Ok(retry_after_value) = HeaderValue::from_str(&retry_after_seconds.max(1).to_string()) {
        response.headers_mut().insert(RETRY_AFTER, retry_after_value);
    }
    response
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

#[derive(Debug, Serialize)]
struct GuildUpdateResponse {
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

#[derive(Debug, Deserialize)]
struct ChannelPathParams {
    channel_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct PatchChannelRequest {
    name: String,
}

#[derive(Debug, Serialize)]
struct ChannelPatchResponse {
    channel: guild_channel::ChannelSummary,
}

#[derive(Debug, Serialize)]
struct ProfileResponse {
    profile: profile::ProfileSettings,
}

#[derive(Debug, Deserialize)]
struct ModerationGuildPathParams {
    guild_id: String,
}

#[derive(Debug, Deserialize)]
struct ModerationReportPathParams {
    guild_id: String,
    report_id: String,
}

#[derive(Debug, Deserialize)]
struct CreateModerationReportRequest {
    target_type: String,
    target_id: i64,
    reason: String,
}

#[derive(Debug, Deserialize)]
struct CreateModerationMuteRequest {
    target_user_id: i64,
    reason: String,
    expires_at: Option<String>,
}

#[derive(Debug, Serialize)]
struct ModerationReportResponse {
    report: moderation::ModerationReport,
}

#[derive(Debug, Serialize)]
struct ModerationReportListResponse {
    reports: Vec<moderation::ModerationReport>,
}

#[derive(Debug, Serialize)]
struct ModerationMuteResponse {
    mute: moderation::ModerationMute,
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

/// channel_idパスパラメータを検証する。
/// @param raw_channel_id 生のchannel_id文字列
/// @returns 検証済みchannel_id
/// @throws GuildChannelError パラメータ不正時
fn parse_channel_id(raw_channel_id: &str) -> Result<i64, GuildChannelError> {
    let parsed = raw_channel_id
        .parse::<i64>()
        .map_err(|_| GuildChannelError::validation("channel_id_invalid"))?;
    if parsed <= 0 {
        return Err(GuildChannelError::validation("channel_id_must_be_positive"));
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

/// JSON入力を検証してguild更新ペイロードを取得する。
/// @param payload JSON抽出結果
/// @returns 検証済みguild更新入力
/// @throws GuildChannelError JSON不正時
fn parse_guild_patch_payload(
    payload: Result<Json<serde_json::Value>, JsonRejection>,
) -> Result<guild_channel::GuildPatchInput, GuildChannelError> {
    let payload = payload
        .map(|Json(value)| value)
        .map_err(|_| GuildChannelError::validation("request_body_invalid"))?;
    let payload = payload
        .as_object()
        .ok_or_else(|| GuildChannelError::validation("request_body_invalid"))?;

    let name = match payload.get("name") {
        Some(serde_json::Value::String(value)) => Some(value.clone()),
        Some(serde_json::Value::Null) => {
            return Err(GuildChannelError::validation("guild_name_null_not_allowed"));
        }
        Some(_) => return Err(GuildChannelError::validation("guild_name_invalid_type")),
        None => None,
    };

    let icon_key = match payload.get("icon_key") {
        Some(serde_json::Value::String(value)) => Some(Some(value.clone())),
        Some(serde_json::Value::Null) => Some(None),
        Some(_) => return Err(GuildChannelError::validation("icon_key_invalid_type")),
        None => None,
    };

    let patch = guild_channel::GuildPatchInput { name, icon_key };
    if patch.is_empty() {
        return Err(GuildChannelError::validation("guild_patch_empty"));
    }

    Ok(patch)
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

/// guild_idパスパラメータをモデレーション向けに検証する。
/// @param raw_guild_id 生のguild_id文字列
/// @returns 検証済みguild_id
/// @throws ModerationError パラメータ不正時
fn parse_moderation_guild_id(raw_guild_id: &str) -> Result<i64, ModerationError> {
    let parsed = raw_guild_id
        .parse::<i64>()
        .map_err(|_| ModerationError::validation("guild_id_invalid"))?;
    if parsed <= 0 {
        return Err(ModerationError::validation("guild_id_must_be_positive"));
    }

    Ok(parsed)
}

/// report_idパスパラメータを検証する。
/// @param raw_report_id 生のreport_id文字列
/// @returns 検証済みreport_id
/// @throws ModerationError パラメータ不正時
fn parse_report_id(raw_report_id: &str) -> Result<i64, ModerationError> {
    let parsed = raw_report_id
        .parse::<i64>()
        .map_err(|_| ModerationError::validation("report_id_invalid"))?;
    if parsed <= 0 {
        return Err(ModerationError::validation("report_id_must_be_positive"));
    }

    Ok(parsed)
}

/// JSON入力を検証してモデレーションペイロードを取得する。
/// @param payload JSON抽出結果
/// @returns 検証済みJSONペイロード
/// @throws ModerationError JSON不正時
fn parse_moderation_json_payload<T>(
    payload: Result<Json<T>, JsonRejection>,
) -> Result<T, ModerationError> {
    payload
        .map(|Json(value)| value)
        .map_err(|_| ModerationError::validation("request_body_invalid"))
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

/// guild設定を更新する。
/// @param state アプリケーション状態
/// @param auth_context 認証文脈
/// @param params パスパラメータ
/// @param payload 更新入力
/// @returns 更新結果レスポンス
/// @throws なし
async fn patch_guild(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(params): Path<GuildPathParams>,
    payload: Result<Json<serde_json::Value>, JsonRejection>,
) -> Response {
    let request_id = auth_context.request_id.clone();
    let guild_id = match parse_guild_id(&params.guild_id) {
        Ok(value) => value,
        Err(error) => return guild_channel_error_response(&error, request_id),
    };
    let patch = match parse_guild_patch_payload(payload) {
        Ok(value) => value,
        Err(error) => {
            tracing::warn!(
                decision = "deny",
                request_id = %request_id,
                principal_id = auth_context.principal_id.0,
                guild_id = guild_id,
                error_class = "validation_invalid_input",
                reason = %error.reason,
                action = "manage",
                resource = "guild",
                decision_source = "request_validation",
                "guild update rejected at request validation"
            );
            return guild_channel_error_response(&error, request_id);
        }
    };

    match state
        .guild_channel_service
        .update_guild(auth_context.principal_id, guild_id, patch)
        .await
    {
        Ok(guild) => {
            tracing::info!(
                decision = "allow",
                request_id = %request_id,
                principal_id = auth_context.principal_id.0,
                guild_id = guild_id,
                error_class = "none",
                action = "manage",
                resource = "guild",
                decision_source = "guild_service",
                "guild update accepted"
            );
            Json(GuildUpdateResponse { guild }).into_response()
        }
        Err(error) => {
            let (decision, error_class) = match error.kind {
                guild_channel::GuildChannelErrorKind::Validation => {
                    ("deny", "validation_invalid_input")
                }
                guild_channel::GuildChannelErrorKind::Forbidden => ("deny", "authz_denied"),
                guild_channel::GuildChannelErrorKind::NotFound => ("deny", "resource_not_found"),
                guild_channel::GuildChannelErrorKind::ChannelNotFound => {
                    ("deny", "resource_not_found")
                }
                guild_channel::GuildChannelErrorKind::DependencyUnavailable => {
                    ("unavailable", "dependency_unavailable")
                }
            };
            tracing::warn!(
                decision = decision,
                request_id = %request_id,
                principal_id = auth_context.principal_id.0,
                guild_id = guild_id,
                error_class = error_class,
                reason = %error.reason,
                action = "manage",
                resource = "guild",
                decision_source = "guild_service",
                "guild update rejected"
            );
            guild_channel_error_response(&error, request_id)
        }
    }
}

/// guildを削除する。
/// @param state アプリケーション状態
/// @param auth_context 認証文脈
/// @param params パスパラメータ
/// @returns 削除成功時は 204 No Content
/// @throws なし
async fn delete_guild(
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
        .delete_guild(auth_context.principal_id, guild_id)
        .await
    {
        Ok(()) => {
            tracing::info!(
                decision = "allow",
                request_id = %request_id,
                principal_id = auth_context.principal_id.0,
                guild_id = guild_id,
                error_class = "none",
                action = "manage",
                resource = "guild",
                decision_source = "guild_service",
                "guild delete accepted"
            );
            StatusCode::NO_CONTENT.into_response()
        }
        Err(error) => {
            let (decision, error_class) = match error.kind {
                guild_channel::GuildChannelErrorKind::Validation => {
                    ("deny", "validation_invalid_input")
                }
                guild_channel::GuildChannelErrorKind::Forbidden => ("deny", "authz_denied"),
                guild_channel::GuildChannelErrorKind::NotFound => ("deny", "resource_not_found"),
                guild_channel::GuildChannelErrorKind::ChannelNotFound => {
                    ("deny", "resource_not_found")
                }
                guild_channel::GuildChannelErrorKind::DependencyUnavailable => {
                    ("unavailable", "dependency_unavailable")
                }
            };
            tracing::warn!(
                decision = decision,
                request_id = %request_id,
                principal_id = auth_context.principal_id.0,
                guild_id = guild_id,
                error_class = error_class,
                reason = %error.reason,
                action = "manage",
                resource = "guild",
                decision_source = "guild_service",
                "guild delete rejected"
            );
            guild_channel_error_response(&error, request_id)
        }
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

/// channelを更新する。
/// @param state アプリケーション状態
/// @param auth_context 認証文脈
/// @param params パスパラメータ
/// @param payload 更新入力
/// @returns 更新後channelレスポンス
/// @throws なし
async fn update_guild_channel(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(params): Path<ChannelPathParams>,
    payload: Result<Json<PatchChannelRequest>, JsonRejection>,
) -> Response {
    let request_id = auth_context.request_id.clone();
    let channel_id = match parse_channel_id(&params.channel_id) {
        Ok(value) => value,
        Err(error) => return guild_channel_error_response(&error, request_id),
    };
    let payload = match parse_json_payload(payload) {
        Ok(value) => value,
        Err(error) => return guild_channel_error_response(&error, request_id),
    };

    match state
        .guild_channel_service
        .update_guild_channel(
            auth_context.principal_id,
            channel_id,
            guild_channel::ChannelPatchInput { name: payload.name },
        )
        .await
    {
        Ok(channel) => Json(ChannelPatchResponse { channel }).into_response(),
        Err(error) => guild_channel_error_response(&error, request_id),
    }
}

/// channelを削除する。
/// @param state アプリケーション状態
/// @param auth_context 認証文脈
/// @param params パスパラメータ
/// @returns 削除成功時は 204 No Content
/// @throws なし
async fn delete_guild_channel(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(params): Path<ChannelPathParams>,
) -> Response {
    let request_id = auth_context.request_id.clone();
    let channel_id = match parse_channel_id(&params.channel_id) {
        Ok(value) => value,
        Err(error) => return guild_channel_error_response(&error, request_id),
    };

    match state
        .guild_channel_service
        .delete_guild_channel(auth_context.principal_id, channel_id)
        .await
    {
        Ok(()) => StatusCode::NO_CONTENT.into_response(),
        Err(error) => guild_channel_error_response(&error, request_id),
    }
}

/// guild配下のモデレーション通報キューを返す。
/// @param state アプリケーション状態
/// @param auth_context 認証文脈
/// @param params パスパラメータ
/// @returns 通報キューレスポンス
/// @throws なし
async fn list_moderation_reports(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(params): Path<ModerationGuildPathParams>,
) -> Response {
    let request_id = auth_context.request_id.clone();
    let guild_id = match parse_moderation_guild_id(&params.guild_id) {
        Ok(value) => value,
        Err(error) => return moderation_error_response(&error, request_id),
    };

    match state
        .moderation_service
        .list_reports(auth_context.principal_id, guild_id)
        .await
    {
        Ok(reports) => Json(ModerationReportListResponse { reports }).into_response(),
        Err(error) => moderation_error_response(&error, request_id),
    }
}

/// モデレーション通報を作成する。
/// @param state アプリケーション状態
/// @param auth_context 認証文脈
/// @param params パスパラメータ
/// @param payload 作成入力
/// @returns 作成済み通報レスポンス
/// @throws なし
async fn create_moderation_report(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(params): Path<ModerationGuildPathParams>,
    payload: Result<Json<CreateModerationReportRequest>, JsonRejection>,
) -> Response {
    let request_id = auth_context.request_id.clone();
    let guild_id = match parse_moderation_guild_id(&params.guild_id) {
        Ok(value) => value,
        Err(error) => return moderation_error_response(&error, request_id),
    };
    let payload = match parse_moderation_json_payload(payload) {
        Ok(value) => value,
        Err(error) => return moderation_error_response(&error, request_id),
    };
    let target_type = match moderation::ModerationTargetType::parse_api_label(&payload.target_type) {
        Some(value) => value,
        None => {
            return moderation_error_response(
                &ModerationError::validation("target_type_invalid"),
                request_id,
            );
        }
    };

    let input = moderation::CreateModerationReportInput {
        guild_id,
        target_type,
        target_id: payload.target_id,
        reason: payload.reason,
    };

    match state
        .moderation_service
        .create_report(auth_context.principal_id, input)
        .await
    {
        Ok(report) => (StatusCode::CREATED, Json(ModerationReportResponse { report })).into_response(),
        Err(error) => moderation_error_response(&error, request_id),
    }
}

/// モデレーションミュートを作成または更新する。
/// @param state アプリケーション状態
/// @param auth_context 認証文脈
/// @param params パスパラメータ
/// @param payload 作成入力
/// @returns 作成済みミュートレスポンス
/// @throws なし
async fn create_moderation_mute(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(params): Path<ModerationGuildPathParams>,
    payload: Result<Json<CreateModerationMuteRequest>, JsonRejection>,
) -> Response {
    let request_id = auth_context.request_id.clone();
    let guild_id = match parse_moderation_guild_id(&params.guild_id) {
        Ok(value) => value,
        Err(error) => return moderation_error_response(&error, request_id),
    };
    let payload = match parse_moderation_json_payload(payload) {
        Ok(value) => value,
        Err(error) => return moderation_error_response(&error, request_id),
    };
    let input = moderation::CreateModerationMuteInput {
        guild_id,
        target_user_id: payload.target_user_id,
        reason: payload.reason,
        expires_at: payload.expires_at,
    };

    match state
        .moderation_service
        .create_mute(auth_context.principal_id, input)
        .await
    {
        Ok(mute) => (StatusCode::CREATED, Json(ModerationMuteResponse { mute })).into_response(),
        Err(error) => moderation_error_response(&error, request_id),
    }
}

/// 通報詳細を返す。
/// @param state アプリケーション状態
/// @param auth_context 認証文脈
/// @param params パスパラメータ
/// @returns 通報詳細レスポンス
/// @throws なし
async fn get_moderation_report(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(params): Path<ModerationReportPathParams>,
) -> Response {
    let request_id = auth_context.request_id.clone();
    let guild_id = match parse_moderation_guild_id(&params.guild_id) {
        Ok(value) => value,
        Err(error) => return moderation_error_response(&error, request_id),
    };
    let report_id = match parse_report_id(&params.report_id) {
        Ok(value) => value,
        Err(error) => return moderation_error_response(&error, request_id),
    };

    match state
        .moderation_service
        .get_report(auth_context.principal_id, guild_id, report_id)
        .await
    {
        Ok(report) => Json(ModerationReportResponse { report }).into_response(),
        Err(error) => moderation_error_response(&error, request_id),
    }
}

/// 通報をresolveへ遷移する。
/// @param state アプリケーション状態
/// @param auth_context 認証文脈
/// @param params パスパラメータ
/// @returns 更新済み通報レスポンス
/// @throws なし
async fn resolve_moderation_report(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(params): Path<ModerationReportPathParams>,
) -> Response {
    let request_id = auth_context.request_id.clone();
    let guild_id = match parse_moderation_guild_id(&params.guild_id) {
        Ok(value) => value,
        Err(error) => return moderation_error_response(&error, request_id),
    };
    let report_id = match parse_report_id(&params.report_id) {
        Ok(value) => value,
        Err(error) => return moderation_error_response(&error, request_id),
    };

    match state
        .moderation_service
        .resolve_report(auth_context.principal_id, guild_id, report_id)
        .await
    {
        Ok(report) => Json(ModerationReportResponse { report }).into_response(),
        Err(error) => moderation_error_response(&error, request_id),
    }
}

/// 通報をreopenへ遷移する。
/// @param state アプリケーション状態
/// @param auth_context 認証文脈
/// @param params パスパラメータ
/// @returns 更新済み通報レスポンス
/// @throws なし
async fn reopen_moderation_report(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(params): Path<ModerationReportPathParams>,
) -> Response {
    let request_id = auth_context.request_id.clone();
    let guild_id = match parse_moderation_guild_id(&params.guild_id) {
        Ok(value) => value,
        Err(error) => return moderation_error_response(&error, request_id),
    };
    let report_id = match parse_report_id(&params.report_id) {
        Ok(value) => value,
        Err(error) => return moderation_error_response(&error, request_id),
    };

    match state
        .moderation_service
        .reopen_report(auth_context.principal_id, guild_id, report_id)
        .await
    {
        Ok(report) => Json(ModerationReportResponse { report }).into_response(),
        Err(error) => moderation_error_response(&error, request_id),
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

    if let Some(rate_limit_action) = rest_rate_limit_action_for_request(&request_method, &request_path)
    {
        let decision = state
            .rest_rate_limit_service
            .evaluate(authenticated.principal_id, rate_limit_action)
            .await;
        if !decision.allowed() {
            let error_class = if decision.is_fail_close() {
                "rate_limit_fail_close"
            } else {
                "rate_limited"
            };
            let reason = if decision.is_fail_close() {
                "dragonfly_degraded_fail_close"
            } else {
                "rate_limit_exceeded"
            };
            let message = if decision.is_fail_close() {
                "request rejected while rate-limit dependency is degraded"
            } else {
                "request rate limit exceeded"
            };
            tracing::warn!(
                decision = "deny",
                request_id = %request_id,
                principal_id = authenticated.principal_id.0,
                error_class = error_class,
                reason = reason,
                resource = %request_path,
                action = decision.action().label(),
                operation_class = ?decision.operation_class(),
                degraded = decision.degraded(),
                decision_source = "rest_rate_limit_service",
                "REST request rejected by rate limit"
            );
            return rate_limit_error_response(
                "RATE_LIMITED",
                message,
                request_id,
                decision.retry_after_seconds().unwrap_or(1),
            );
        }
    }

    let action = rest_authz_action_for_request(&request_method, &request_path);
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
/// @param path リクエストパス
/// @returns AuthZ action
/// @throws なし
fn rest_authz_action_for_request(method: &axum::http::Method, path: &str) -> AuthzAction {
    if path == "/internal/authz/cache/invalidate" {
        return AuthzAction::View;
    }
    rest_authz_action_from_method(method)
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
    match segments.as_slice() {
        ["guilds", guild_id] => guild_id.parse::<i64>().ok(),
        ["v1", "guilds", guild_id] => guild_id.parse::<i64>().ok(),
        _ => None,
    }
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
