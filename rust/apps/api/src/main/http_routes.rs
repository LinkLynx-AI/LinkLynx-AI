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
        .route(
            "/guilds/{guild_id}",
            patch(patch_guild).delete(delete_guild),
        )
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
        .route(
            "/users/me/profile/media/upload-url",
            post(issue_my_profile_media_upload_url),
        )
        .route(
            "/users/me/profile/media/{target}/download-url",
            get(get_my_profile_media_download_url),
        )
        .route("/v1/users/{user_id}/profile", get(get_user_profile))
        .route("/v1/guilds/{guild_id}", get(get_guild))
        .route("/v1/guilds/{guild_id}", axum::routing::patch(update_guild))
        .route("/v1/guilds/{guild_id}/members", get(get_guild_members))
        .route("/v1/guilds/{guild_id}/roles", get(get_guild_roles))
        .route(
            "/v1/guilds/{guild_id}/invites",
            get(list_guild_invites).post(create_guild_invite),
        )
        .route(
            "/v1/guilds/{guild_id}/invites/{invite_code}",
            get(get_guild_invite).delete(revoke_guild_invite),
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
        .route(
            "/v1/guilds/{guild_id}/channels/{channel_id}/messages/{message_id}",
            axum::routing::patch(edit_channel_message).delete(delete_channel_message),
        )
        .route(
            "/guilds/{guild_id}/permission-snapshot",
            get(get_permission_snapshot),
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
        .route(
            "/users/me/dms",
            get(list_dm_channels).post(open_or_create_dm),
        )
        .route("/v1/invites/{invite_code}", get(get_public_invite))
        .route("/v1/invites/{invite_code}/join", post(join_public_invite))
        .route("/internal/scylla/health", get(scylla_health_check))
        .route("/ws", get(ws_handler))
        .route("/auth/ws-ticket", post(issue_ws_ticket))
        .merge(protected_routes)
        .with_state(state)
        .layer(cors)
}

const PUBLIC_INVITE_TRUSTED_PROXY_SHARED_SECRET_ENV: &str =
    "PUBLIC_INVITE_TRUSTED_PROXY_SHARED_SECRET";
const PUBLIC_INVITE_CLIENT_SCOPE_HEADER: &str = "x-linklynx-client-scope";
const PUBLIC_INVITE_TRUSTED_PROXY_SECRET_HEADER: &str = "x-linklynx-trusted-proxy-secret";
const PUBLIC_INVITE_ANONYMOUS_CLIENT_SCOPE: &str = "anonymous";
const PUBLIC_INVITE_MAX_CLIENT_SCOPE_LEN: usize = 128;

#[derive(Debug, Clone)]
struct PublicInviteClientScope {
    key_fragment: String,
    log_value: String,
    source: &'static str,
}

impl PublicInviteClientScope {
    fn trusted(scope: String) -> Self {
        Self {
            key_fragment: scope.clone(),
            log_value: scope,
            source: "trusted_proxy_header",
        }
    }

    fn anonymous() -> Self {
        Self {
            key_fragment: PUBLIC_INVITE_ANONYMOUS_CLIENT_SCOPE.to_owned(),
            log_value: PUBLIC_INVITE_ANONYMOUS_CLIENT_SCOPE.to_owned(),
            source: "anonymous_fallback",
        }
    }
}

/// 実行時の public invite trusted proxy shared secret を解決する。
/// @param なし
/// @returns 設定済み secret。未設定または空文字時は `None`
/// @throws なし
fn build_runtime_public_invite_trusted_proxy_shared_secret() -> Option<String> {
    match env::var(PUBLIC_INVITE_TRUSTED_PROXY_SHARED_SECRET_ENV) {
        Ok(shared_secret) if shared_secret.trim().is_empty() => {
            tracing::warn!(
                env_var = PUBLIC_INVITE_TRUSTED_PROXY_SHARED_SECRET_ENV,
                "blank public invite trusted proxy secret is invalid; anonymous fallback will be used"
            );
            None
        }
        Ok(shared_secret) => Some(shared_secret),
        Err(_) => None,
    }
}

/// 公開invite向け client scope をヘッダーから解決する。
/// @param headers リクエストヘッダー
/// @param trusted_proxy_shared_secret runtime で信頼する proxy shared secret
/// @returns rate-limit と監査ログに使う client scope
/// @throws なし
fn resolve_public_invite_client_scope(
    headers: &HeaderMap,
    trusted_proxy_shared_secret: Option<&str>,
) -> PublicInviteClientScope {
    let provided_secret = headers
        .get(PUBLIC_INVITE_TRUSTED_PROXY_SECRET_HEADER)
        .and_then(|value| value.to_str().ok());
    let provided_scope = headers
        .get(PUBLIC_INVITE_CLIENT_SCOPE_HEADER)
        .and_then(|value| value.to_str().ok())
        .and_then(normalize_public_invite_client_scope_value);

    if trusted_proxy_shared_secret.is_some()
        && trusted_proxy_shared_secret == provided_secret
        && provided_scope.is_some()
    {
        return PublicInviteClientScope::trusted(provided_scope.unwrap_or_default());
    }

    PublicInviteClientScope::anonymous()
}

/// public invite client scope ヘッダー値を正規化する。
/// @param raw_scope 生のヘッダー値
/// @returns 利用可能な client scope。無効値は `None`
/// @throws なし
fn normalize_public_invite_client_scope_value(raw_scope: &str) -> Option<String> {
    let trimmed = raw_scope.trim();
    if trimmed.is_empty() || trimmed.len() > PUBLIC_INVITE_MAX_CLIENT_SCOPE_LEN {
        return None;
    }
    if !trimmed.chars().all(|ch| {
        ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.' | ':')
    }) {
        return None;
    }

    Some(trimmed.to_owned())
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

/// Scylla 詳細ヘルスチェック応答を返す。
/// @param state アプリケーション状態
/// @returns Scylla health レポート
/// @throws なし
async fn scylla_health_check(State(state): State<AppState>) -> Response {
    state.scylla_health_reporter.report().await.into_response()
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
struct GuildInviteResponse {
    ok: bool,
    request_id: String,
    principal_id: i64,
    guild_id: i64,
    invite_code: String,
}

#[derive(Debug, Serialize)]
struct CreateInviteResponse {
    ok: bool,
    request_id: String,
    invite: invite::CreatedInvite,
}

#[derive(Debug, Serialize)]
struct ListGuildInvitesResponse {
    ok: bool,
    request_id: String,
    invites: Vec<invite::GuildInviteSummary>,
}

#[derive(Debug, Serialize)]
struct InviteVerifyResponse {
    ok: bool,
    request_id: String,
    invite: invite::PublicInviteLookup,
}

#[derive(Debug, Serialize)]
struct InviteJoinResponse {
    ok: bool,
    request_id: String,
    join: invite::InviteJoinResult,
}

#[derive(Debug, Serialize)]
struct DmChannelResponse {
    channel: dm::DmChannelSummary,
}

#[derive(Debug, Serialize)]
struct DmChannelListResponse {
    channels: Vec<dm::DmChannelSummary>,
}

#[derive(Debug, Deserialize)]
struct OpenOrCreateDmRequest {
    recipient_id: i64,
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

/// guild配下の有効な招待一覧を返す。
/// @param state アプリケーション状態
/// @param auth_context 認証文脈
/// @param params パスパラメータ
/// @returns 招待一覧レスポンス
/// @throws なし
async fn list_guild_invites(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(params): Path<GuildPathParams>,
) -> Response {
    let request_id = auth_context.request_id.clone();
    let guild_id = match parse_guild_id(&params.guild_id) {
        Ok(value) => value,
        Err(error) => {
            return invite_error_response(
                &invite::InviteError::validation(error.reason),
                request_id,
            )
        }
    };

    match state
        .invite_service
        .list_invites(auth_context.principal_id, guild_id)
        .await
    {
        Ok(invites) => Json(ListGuildInvitesResponse {
            ok: true,
            request_id,
            invites,
        })
        .into_response(),
        Err(error) => invite_error_response(&error, request_id),
    }
}

/// 公開招待コードの状態を返す。
/// @param state アプリケーション状態
/// @param headers HTTPヘッダー
/// @param params パスパラメータ
/// @returns 招待検証レスポンス
/// @throws なし
async fn get_public_invite(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(params): Path<InviteVerifyPathParams>,
) -> Response {
    let request_id = request_id_from_headers(&headers);
    let invite_code = params.invite_code;
    let client_scope = resolve_public_invite_client_scope(
        &headers,
        state.public_invite_trusted_proxy_shared_secret.as_deref(),
    );
    let rate_limit_decision = state
        .rest_rate_limit_service
        .evaluate_key(
            public_invite_rate_limit_key(&client_scope),
            RestRateLimitAction::InviteAccess,
        )
        .await;
    if !rate_limit_decision.allowed() {
        let error_class = if rate_limit_decision.is_fail_close() {
            "rate_limit_fail_close"
        } else {
            "rate_limited"
        };
        let reason = if rate_limit_decision.is_fail_close() {
            "dragonfly_degraded_fail_close"
        } else {
            "rate_limit_exceeded"
        };
        let message = if rate_limit_decision.is_fail_close() {
            "request rejected while rate-limit dependency is degraded"
        } else {
            "request rate limit exceeded"
        };
        tracing::warn!(
            decision = "deny",
            request_id = %request_id,
            invite_code = %invite_code,
            client_scope = %client_scope.log_value,
            client_scope_source = client_scope.source,
            error_class = error_class,
            reason = reason,
            resource = "/v1/invites/{invite_code}",
            action = rate_limit_decision.action().label(),
            operation_class = ?rate_limit_decision.operation_class(),
            degraded = rate_limit_decision.degraded(),
            decision_source = "rest_rate_limit_service",
            "public invite verification rejected by rate limit"
        );
        return rate_limit_error_response(
            "RATE_LIMITED",
            message,
            request_id,
            rate_limit_decision.retry_after_seconds().unwrap_or(1),
        );
    }

    match state
        .invite_service
        .verify_public_invite(invite_code)
        .await
    {
        Ok(invite) => Json(InviteVerifyResponse {
            ok: true,
            request_id,
            invite,
        })
        .into_response(),
        Err(error) => invite_error_response(&error, request_id),
    }
}

/// 認証済みユーザーを公開招待コードでギルドへ参加させる。
/// @param state アプリケーション状態
/// @param headers HTTPヘッダー
/// @param params パスパラメータ
/// @returns 招待参加レスポンス
/// @throws なし
async fn join_public_invite(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(params): Path<InviteVerifyPathParams>,
) -> Response {
    let request_id = request_id_from_headers(&headers);
    let invite_code = params.invite_code;
    let client_scope = resolve_public_invite_client_scope(
        &headers,
        state.public_invite_trusted_proxy_shared_secret.as_deref(),
    );
    let token = match bearer_token_from_headers(&headers) {
        Ok(token) => token,
        Err(error) => {
            tracing::warn!(
                decision = %error.decision(),
                request_id = %request_id,
                invite_code = %invite_code,
                client_scope = %client_scope.log_value,
                client_scope_source = client_scope.source,
                error_class = %error.log_class(),
                reason = %error.reason,
                "invite join rejected at header parsing"
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
                invite_code = %invite_code,
                client_scope = %client_scope.log_value,
                client_scope_source = client_scope.source,
                error_class = %error.log_class(),
                reason = %error.reason,
                "invite join rejected at authentication"
            );
            return auth_error_response(&error, request_id);
        }
    };

    let rate_limit_decision = state
        .rest_rate_limit_service
        .evaluate(
            authenticated.principal_id,
            RestRateLimitAction::InviteAccess,
        )
        .await;
    if !rate_limit_decision.allowed() {
        let error_class = if rate_limit_decision.is_fail_close() {
            "rate_limit_fail_close"
        } else {
            "rate_limited"
        };
        let reason = if rate_limit_decision.is_fail_close() {
            "dragonfly_degraded_fail_close"
        } else {
            "rate_limit_exceeded"
        };
        let message = if rate_limit_decision.is_fail_close() {
            "request rejected while rate-limit dependency is degraded"
        } else {
            "request rate limit exceeded"
        };
        tracing::warn!(
            decision = "deny",
            request_id = %request_id,
            principal_id = authenticated.principal_id.0,
            invite_code = %invite_code,
            client_scope = %client_scope.log_value,
            client_scope_source = client_scope.source,
            error_class = error_class,
            reason = reason,
            resource = "/v1/invites/{invite_code}/join",
            action = rate_limit_decision.action().label(),
            operation_class = ?rate_limit_decision.operation_class(),
            degraded = rate_limit_decision.degraded(),
            decision_source = "rest_rate_limit_service",
            "invite join rejected by rate limit"
        );
        return rate_limit_error_response(
            "RATE_LIMITED",
            message,
            request_id,
            rate_limit_decision.retry_after_seconds().unwrap_or(1),
        );
    }

    match state
        .invite_service
        .join_invite(authenticated.principal_id, invite_code)
        .await
    {
        Ok(join) => Json(InviteJoinResponse {
            ok: true,
            request_id,
            join,
        })
        .into_response(),
        Err(error) => invite_error_response(&error, request_id),
    }
}

/// ギルドチャンネル情報の最小応答を返す。
/// @param path guild_id と channel_id を含むパス
/// @param auth_context 認証文脈
/// @returns チャンネル最小応答
/// @throws なし
async fn get_guild_channel(
    State(state): State<AppState>,
    Path(params): Path<GuildChannelPathParams>,
    Extension(auth_context): Extension<AuthContext>,
) -> Response {
    let request_id = auth_context.request_id.clone();
    let guild_id = match parse_guild_id(&params.guild_id) {
        Ok(value) => value,
        Err(error) => return guild_channel_error_response(&error, request_id),
    };
    let channel_id = match parse_channel_id(&params.channel_id) {
        Ok(value) => value,
        Err(error) => return guild_channel_error_response(&error, request_id),
    };

    match state
        .guild_channel_service
        .get_guild_channel_summary(auth_context.principal_id, guild_id, channel_id)
        .await
    {
        Ok(_) => Json(GuildChannelResponse {
            ok: true,
            request_id: auth_context.request_id,
            principal_id: auth_context.principal_id.0,
            guild_id,
            channel_id,
        })
        .into_response(),
        Err(error) => guild_channel_error_response(&error, request_id),
    }
}

/// message target に利用できる guild channel を検証する。
/// @param state アプリケーション状態
/// @param auth_context 認証文脈
/// @param guild_id 対象guild_id
/// @param channel_id 対象channel_id
/// @returns messageable channel要約
/// @throws GuildChannelError 非messageableまたは取得失敗時
async fn require_messageable_guild_channel(
    state: &AppState,
    auth_context: &AuthContext,
    guild_id: i64,
    channel_id: i64,
) -> Result<guild_channel::ChannelSummary, GuildChannelError> {
    let channel = state
        .guild_channel_service
        .get_guild_channel_summary(auth_context.principal_id, guild_id, channel_id)
        .await?;
    if !channel.kind.is_messageable() {
        return Err(GuildChannelError::forbidden("channel_not_messageable"));
    }

    Ok(channel)
}

/// チャンネルメッセージ一覧の最小応答を返す。
/// @param path guild_id と channel_id を含むパス
/// @param auth_context 認証文脈
/// @returns メッセージ一覧最小応答
/// @throws なし
async fn list_channel_messages(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(params): Path<GuildChannelPathParams>,
    query: Result<Query<ListGuildChannelMessagesQueryV1>, QueryRejection>,
) -> Response {
    let request_id = auth_context.request_id.clone();
    let guild_id = match parse_guild_id(&params.guild_id) {
        Ok(value) => value,
        Err(error) => return guild_channel_error_response(&error, request_id),
    };
    let channel_id = match parse_channel_id(&params.channel_id) {
        Ok(value) => value,
        Err(error) => return guild_channel_error_response(&error, request_id),
    };
    let query = match parse_message_list_query(query) {
        Ok(value) => value,
        Err(error) => return guild_channel_error_response(&error, request_id),
    };
    if let Err(error) =
        require_messageable_guild_channel(&state, &auth_context, guild_id, channel_id).await
    {
        return guild_channel_error_response(&error, request_id);
    }

    match state
        .message_service
        .list_guild_channel_messages(guild_id, channel_id, query)
        .await
    {
        Ok(response) => Json(response).into_response(),
        Err(error) => message_error_response(&error, request_id),
    }
}

/// チャンネルメッセージ作成の最小契約応答を返す。
/// @param auth_context 認証文脈
/// @param params パスパラメータ
/// @param payload 作成入力
/// @returns メッセージ作成レスポンス
/// @throws なし
async fn create_channel_message(
    State(state): State<AppState>,
    headers: HeaderMap,
    Extension(auth_context): Extension<AuthContext>,
    Path(params): Path<GuildChannelPathParams>,
    payload: Result<Json<CreateGuildChannelMessageRequestV1>, JsonRejection>,
) -> Response {
    let request_id = auth_context.request_id.clone();
    let guild_id = match parse_guild_id(&params.guild_id) {
        Ok(value) => value,
        Err(error) => return guild_channel_error_response(&error, request_id),
    };
    let channel_id = match parse_channel_id(&params.channel_id) {
        Ok(value) => value,
        Err(error) => return guild_channel_error_response(&error, request_id),
    };
    if let Err(error) =
        require_messageable_guild_channel(&state, &auth_context, guild_id, channel_id).await
    {
        return guild_channel_error_response(&error, request_id);
    }
    let payload = match parse_json_payload(payload) {
        Ok(value) => value,
        Err(error) => return guild_channel_error_response(&error, request_id),
    };
    let idempotency_key = match parse_idempotency_key(&headers) {
        Ok(value) => value,
        Err(error) => return message_error_response(&error, request_id),
    };

    match state
        .message_service
        .create_guild_channel_message(
            auth_context.principal_id,
            guild_id,
            channel_id,
            idempotency_key.as_deref(),
            payload,
        )
        .await
    {
        Ok(execution) => {
            if execution.should_publish {
                let publish_state = state.clone();
                let published_message = execution.response.message.clone();
                tokio::spawn(async move {
                    publish_state
                        .message_realtime_hub
                        .publish_message_created(&publish_state, published_message)
                        .await;
                });
            }
            (StatusCode::CREATED, Json(execution.response)).into_response()
        }
        Err(error) => message_error_response(&error, request_id),
    }
}

/// チャンネルメッセージ編集の最小契約応答を返す。
/// @param auth_context 認証文脈
/// @param params パスパラメータ
/// @param payload 編集入力
/// @returns メッセージ更新レスポンス
/// @throws なし
async fn edit_channel_message(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(params): Path<GuildChannelMessagePathParams>,
    payload: Result<Json<EditMessageRequest>, JsonRejection>,
) -> Response {
    let request_id = auth_context.request_id.clone();
    let guild_id = match parse_guild_id(&params.guild_id) {
        Ok(value) => value,
        Err(error) => return guild_channel_error_response(&error, request_id),
    };
    let channel_id = match parse_channel_id(&params.channel_id) {
        Ok(value) => value,
        Err(error) => return guild_channel_error_response(&error, request_id),
    };
    let message_id = match parse_message_id(&params.message_id) {
        Ok(value) => value,
        Err(error) => return message_error_response(&error, request_id),
    };
    let payload = match parse_json_payload(payload) {
        Ok(value) => value,
        Err(error) => return guild_channel_error_response(&error, request_id),
    };

    match state
        .message_service
        .edit_guild_channel_message(
            auth_context.principal_id,
            guild_id,
            channel_id,
            message_id,
            EditGuildChannelMessageRequestV1 {
                content: payload.content,
                expected_version: payload.expected_version,
            },
        )
        .await
    {
        Ok(response) => {
            let publish_state = state.clone();
            let published_message = response.message.clone();
            tokio::spawn(async move {
                publish_state
                    .message_realtime_hub
                    .publish_message_updated(&publish_state, published_message)
                    .await;
            });
            Json(response).into_response()
        }
        Err(error) => message_error_response(&error, request_id),
    }
}

/// チャンネルメッセージ削除の最小契約応答を返す。
/// @param auth_context 認証文脈
/// @param params パスパラメータ
/// @param payload 削除入力
/// @returns メッセージ更新レスポンス
/// @throws なし
async fn delete_channel_message(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(params): Path<GuildChannelMessagePathParams>,
    payload: Result<Json<DeleteMessageRequest>, JsonRejection>,
) -> Response {
    let request_id = auth_context.request_id.clone();
    let guild_id = match parse_guild_id(&params.guild_id) {
        Ok(value) => value,
        Err(error) => return guild_channel_error_response(&error, request_id),
    };
    let channel_id = match parse_channel_id(&params.channel_id) {
        Ok(value) => value,
        Err(error) => return guild_channel_error_response(&error, request_id),
    };
    let message_id = match parse_message_id(&params.message_id) {
        Ok(value) => value,
        Err(error) => return message_error_response(&error, request_id),
    };
    let payload = match parse_json_payload(payload) {
        Ok(value) => value,
        Err(error) => return guild_channel_error_response(&error, request_id),
    };

    match state
        .message_service
        .delete_guild_channel_message(
            auth_context.principal_id,
            guild_id,
            channel_id,
            message_id,
            DeleteGuildChannelMessageRequestV1 {
                expected_version: payload.expected_version,
            },
        )
        .await
    {
        Ok(response) => {
            let publish_state = state.clone();
            let published_message = response.message.clone();
            tokio::spawn(async move {
                publish_state
                    .message_realtime_hub
                    .publish_message_deleted(&publish_state, published_message)
                    .await;
            });
            Json(response).into_response()
        }
        Err(error) => message_error_response(&error, request_id),
    }
}
/// create message 用 idempotency key を取り出す。
/// @param headers HTTP ヘッダー
/// @returns optional idempotency key
/// @throws MessageError ヘッダー値が空または不正な場合
fn parse_idempotency_key(headers: &HeaderMap) -> Result<Option<String>, MessageError> {
    let Some(value) = headers.get("Idempotency-Key") else {
        return Ok(None);
    };
    let value = value
        .to_str()
        .map_err(|_| MessageError::validation("message_idempotency_key_invalid"))?;
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(MessageError::validation("message_idempotency_key_invalid"));
    }
    Ok(Some(trimmed.to_owned()))
}

/// DMチャンネル情報の最小応答を返す。
/// @param path channel_id を含むパス
/// @param auth_context 認証文脈
/// @returns DMチャンネル最小応答
/// @throws なし
async fn get_dm_channel(
    State(state): State<AppState>,
    axum::extract::Path(channel_id): axum::extract::Path<i64>,
    Extension(auth_context): Extension<AuthContext>,
) -> Response {
    let request_id = auth_context.request_id.clone();
    match state
        .dm_service
        .get_dm_channel(auth_context.principal_id, channel_id)
        .await
    {
        Ok(channel) => Json(DmChannelResponse { channel }).into_response(),
        Err(error) => dm_error_response(&error, request_id),
    }
}

/// DMメッセージ一覧の最小応答を返す。
/// @param path channel_id を含むパス
/// @param auth_context 認証文脈
/// @returns DMメッセージ一覧最小応答
/// @throws なし
async fn list_dm_messages(
    State(state): State<AppState>,
    axum::extract::Path(channel_id): axum::extract::Path<i64>,
    query: Result<Query<ListGuildChannelMessagesQueryV1>, QueryRejection>,
    Extension(auth_context): Extension<AuthContext>,
) -> Response {
    let request_id = auth_context.request_id.clone();
    let query = match query {
        Ok(Query(value)) => value,
        Err(_) => {
            return message_error_response(
                &MessageError::validation("message_query_invalid"),
                request_id,
            )
        }
    };
    match state
        .dm_service
        .list_dm_messages(auth_context.principal_id, channel_id, query)
        .await
    {
        Ok(messages) => Json(messages).into_response(),
        Err(error) => dm_error_response(&error, request_id),
    }
}

/// DMメッセージ作成の最小応答を返す。
/// @param path channel_id を含むパス
/// @param auth_context 認証文脈
/// @returns DMメッセージ作成最小応答
/// @throws なし
async fn create_dm_message(
    State(state): State<AppState>,
    axum::extract::Path(channel_id): axum::extract::Path<i64>,
    Extension(auth_context): Extension<AuthContext>,
    headers: HeaderMap,
    payload: Result<Json<CreateGuildChannelMessageRequestV1>, JsonRejection>,
) -> Response {
    let request_id = auth_context.request_id.clone();
    let payload = match payload {
        Ok(Json(value)) => value,
        Err(_) => {
            return message_error_response(
                &MessageError::validation("request_body_invalid"),
                request_id,
            )
        }
    };
    let idempotency_key = match parse_idempotency_key(&headers) {
        Ok(value) => value,
        Err(error) => return message_error_response(&error, request_id),
    };
    match state
        .dm_service
        .create_dm_message(
            auth_context.principal_id,
            channel_id,
            idempotency_key.as_deref(),
            payload,
        )
        .await
    {
        Ok(execution) => {
            if execution.should_publish {
                let publish_state = state.clone();
                let published_message = execution.response.message.clone();
                tokio::spawn(async move {
                    publish_state
                        .message_realtime_hub
                        .publish_dm_message_created(&publish_state, published_message)
                        .await;
                });
            }
            (StatusCode::CREATED, Json(execution.response)).into_response()
        }
        Err(error) => dm_error_response(&error, request_id),
    }
}

/// 認証済み主体が参加する DM 一覧を返す。
/// @param state アプリケーション状態
/// @param auth_context 認証文脈
/// @returns DM 一覧
/// @throws なし
async fn list_dm_channels(State(state): State<AppState>, headers: HeaderMap) -> Response {
    let request_id = request_id_from_headers(&headers);
    let token = match bearer_token_from_headers(&headers) {
        Ok(token) => token,
        Err(error) => {
            tracing::warn!(
                decision = %error.decision(),
                request_id = %request_id,
                error_class = %error.log_class(),
                reason = %error.reason,
                "dm list rejected at header parsing"
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
                "dm list rejected at authentication"
            );
            return auth_error_response(&error, request_id);
        }
    };

    match state
        .dm_service
        .list_dm_channels(authenticated.principal_id)
        .await
    {
        Ok(channels) => Json(DmChannelListResponse { channels }).into_response(),
        Err(error) => dm_error_response(&error, request_id),
    }
}

/// 相手ユーザーとの DM を open-or-create する。
/// @param state アプリケーション状態
/// @param auth_context 認証文脈
/// @param payload 作成入力
/// @returns DM 詳細
/// @throws なし
async fn open_or_create_dm(
    State(state): State<AppState>,
    headers: HeaderMap,
    payload: Result<Json<OpenOrCreateDmRequest>, JsonRejection>,
) -> Response {
    let request_id = request_id_from_headers(&headers);
    let token = match bearer_token_from_headers(&headers) {
        Ok(token) => token,
        Err(error) => {
            tracing::warn!(
                decision = %error.decision(),
                request_id = %request_id,
                error_class = %error.log_class(),
                reason = %error.reason,
                "dm open-or-create rejected at header parsing"
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
                "dm open-or-create rejected at authentication"
            );
            return auth_error_response(&error, request_id);
        }
    };
    let payload = match payload {
        Ok(Json(value)) => value,
        Err(_) => {
            return dm_error_response(&dm::DmError::validation("request_body_invalid"), request_id)
        }
    };
    match state
        .dm_service
        .open_or_create_dm(authenticated.principal_id, payload.recipient_id)
        .await
    {
        Ok(channel) => (StatusCode::CREATED, Json(DmChannelResponse { channel })).into_response(),
        Err(error) => dm_error_response(&error, request_id),
    }
}

/// モデレーション対象メンバーへミュート操作を適用する。
/// @param state アプリケーション状態
/// @param path guild_id と member_id を含むパス
/// @param auth_context 認証文脈
/// @param payload ミュート入力
/// @returns モデレーション結果レスポンス
/// @throws なし
async fn moderate_guild_member(
    State(state): State<AppState>,
    axum::extract::Path((guild_id, member_id)): axum::extract::Path<(i64, i64)>,
    Extension(auth_context): Extension<AuthContext>,
    payload: Result<Json<PatchModerationMemberRequest>, JsonRejection>,
) -> Response {
    let request_id = auth_context.request_id.clone();
    let guild_id = match parse_moderation_guild_id(&guild_id.to_string()) {
        Ok(value) => value,
        Err(error) => return moderation_error_response(&error, request_id),
    };
    let target_user_id = match moderation::normalize_positive_id(
        member_id,
        "target_user_id_must_be_positive",
    ) {
        Ok(value) => value,
        Err(error) => return moderation_error_response(&error, request_id),
    };
    let payload = match parse_moderation_json_payload(payload) {
        Ok(value) => value,
        Err(error) => return moderation_error_response(&error, request_id),
    };

    tracing::info!(
        request_id = %auth_context.request_id,
        principal_id = auth_context.principal_id.0,
        guild_id,
        member_id = target_user_id,
        action = "mute",
        "moderation member patch request accepted"
    );

    let input = moderation::CreateModerationMuteInput {
        guild_id,
        target_user_id,
        reason: payload.reason,
        expires_at: payload.expires_at,
    };

    match state
        .moderation_service
        .create_mute(auth_context.principal_id, input)
        .await
    {
        Ok(mute) => {
            tracing::info!(
                request_id = %auth_context.request_id,
                principal_id = auth_context.principal_id.0,
                guild_id,
                member_id = target_user_id,
                action = "mute",
                "moderation member patch completed"
            );
            (StatusCode::OK, Json(ModerationMuteResponse { mute })).into_response()
        }
        Err(error) => {
            tracing::warn!(
                request_id = %auth_context.request_id,
                principal_id = auth_context.principal_id.0,
                guild_id,
                member_id = target_user_id,
                action = "mute",
                error_kind = ?error.kind,
                reason = %error.reason,
                "moderation member patch failed"
            );
            moderation_error_response(&error, request_id)
        }
    }
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
        "channel_role_override_changed" => {
            AuthzCacheInvalidationEventKind::ChannelRoleOverrideChanged {
                guild_id: payload.guild_id.ok_or("guild_id is required")?,
                channel_id: payload.channel_id.ok_or("channel_id is required")?,
            }
        }
        "channel_user_override_changed" => {
            AuthzCacheInvalidationEventKind::ChannelUserOverrideChanged {
                guild_id: payload.guild_id.ok_or("guild_id is required")?,
                channel_id: payload.channel_id.ok_or("channel_id is required")?,
                user_id: payload.user_id.ok_or("user_id is required")?,
            }
        }
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
        response
            .headers_mut()
            .insert(RETRY_AFTER, retry_after_value);
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

#[derive(Debug, Deserialize)]
struct GuildChannelPathParams {
    guild_id: String,
    channel_id: String,
}

#[derive(Debug, Deserialize)]
struct GuildChannelMessagePathParams {
    guild_id: String,
    channel_id: String,
    message_id: String,
}

#[derive(Debug, Deserialize)]
struct GuildInvitePathParams {
    guild_id: String,
    invite_code: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct EditMessageRequest {
    content: String,
    expected_version: i64,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct DeleteMessageRequest {
    expected_version: i64,
}

#[derive(Debug, Deserialize)]
struct InviteVerifyPathParams {
    invite_code: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct CreateInviteRequest {
    channel_id: i64,
    #[serde(default)]
    max_age_seconds: Option<i64>,
    #[serde(default)]
    max_uses: Option<i32>,
}

#[derive(Debug, Deserialize)]
struct PermissionSnapshotQuery {
    channel_id: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct PermissionSnapshotAuditFields {
    principal_id: i64,
    guild_id: i64,
    channel_id: Option<i64>,
    action: &'static str,
    resource: &'static str,
    decision_source: &'static str,
}

#[derive(Debug, Serialize)]
struct PermissionSnapshotResponse {
    request_id: String,
    snapshot: PermissionSnapshot,
}

#[derive(Debug, Serialize)]
struct PermissionSnapshot {
    guild_id: i64,
    channel_id: Option<i64>,
    guild: GuildPermissionSnapshot,
    channel: Option<ChannelPermissionSnapshot>,
}

#[derive(Debug, Serialize)]
struct GuildPermissionSnapshot {
    can_view: bool,
    can_create_channel: bool,
    can_create_invite: bool,
    can_manage_settings: bool,
    can_moderate: bool,
}

#[derive(Debug, Serialize)]
struct ChannelPermissionSnapshot {
    can_view: bool,
    can_post: bool,
    can_manage: bool,
}

#[derive(Debug, Serialize)]
struct ChannelListResponse {
    channels: Vec<guild_channel::ChannelSummary>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct CreateChannelRequest {
    name: String,
    #[serde(default)]
    r#type: Option<guild_channel::ChannelKind>,
    #[serde(default)]
    parent_id: Option<i64>,
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

#[derive(Debug, Serialize)]
struct UserProfileResponse {
    profile: user_directory::UserProfileDirectoryEntry,
}

#[derive(Debug, Serialize)]
struct GuildMembersResponse {
    members: Vec<user_directory::GuildMemberDirectoryEntry>,
}

#[derive(Debug, Serialize)]
struct GuildRolesResponse {
    roles: Vec<user_directory::GuildRoleDirectoryEntry>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct ProfileMediaUploadUrlRequest {
    target: String,
    filename: String,
    content_type: String,
}

#[derive(Debug, Deserialize)]
struct ProfileMediaTargetPathParams {
    target: String,
}

#[derive(Debug, Serialize)]
struct ProfileMediaUploadUrlResponse {
    upload: profile::ProfileMediaUpload,
}

#[derive(Debug, Serialize)]
struct ProfileMediaDownloadUrlResponse {
    media: profile::ProfileMediaDownload,
}

#[derive(Debug, Deserialize)]
struct ModerationGuildPathParams {
    guild_id: String,
}

#[derive(Debug, Deserialize)]
struct UserPathParams {
    user_id: String,
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

#[derive(Debug, Deserialize)]
struct PatchModerationMemberRequest {
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

/// user directory 向けguild_idパスパラメータを検証する。
/// @param raw_guild_id 生のguild_id文字列
/// @returns 検証済みguild_id
/// @throws UserDirectoryError パラメータ不正時
fn parse_user_directory_guild_id(raw_guild_id: &str) -> Result<i64, UserDirectoryError> {
    let parsed = raw_guild_id
        .parse::<i64>()
        .map_err(|_| UserDirectoryError::validation("guild_id_invalid"))?;
    if parsed <= 0 {
        return Err(UserDirectoryError::validation("guild_id_must_be_positive"));
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

/// message_idパスパラメータを検証する。
/// @param raw_message_id 生のmessage_id文字列
/// @returns 検証済みmessage_id
/// @throws MessageError パラメータ不正時
fn parse_message_id(raw_message_id: &str) -> Result<i64, MessageError> {
    let parsed = raw_message_id
        .parse::<i64>()
        .map_err(|_| MessageError::validation("message_id_invalid"))?;
    if parsed <= 0 {
        return Err(MessageError::validation("message_id_must_be_positive"));
    }

    Ok(parsed)
}

/// user_idパスパラメータを検証する。
/// @param raw_user_id 生のuser_id文字列
/// @returns 検証済みuser_id
/// @throws UserDirectoryError パラメータ不正時
fn parse_user_id(raw_user_id: &str) -> Result<i64, UserDirectoryError> {
    let parsed = raw_user_id
        .parse::<i64>()
        .map_err(|_| UserDirectoryError::validation("user_id_invalid"))?;
    if parsed <= 0 {
        return Err(UserDirectoryError::validation("user_id_must_be_positive"));
    }

    Ok(parsed)
}

/// channel_idクエリパラメータを検証する。
/// @param raw_channel_id 生のchannel_id文字列
/// @returns 検証済みchannel_id
/// @throws GuildChannelError パラメータ不正時
fn parse_optional_channel_id(
    raw_channel_id: Option<&str>,
) -> Result<Option<i64>, GuildChannelError> {
    raw_channel_id.map(parse_channel_id).transpose()
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

/// invite create 向けJSON payloadを検証する。
/// @param payload JSON抽出結果
/// @returns 検証済みpayload
/// @throws InviteError JSON形式不正時
fn parse_invite_json_payload<T>(
    payload: Result<Json<T>, JsonRejection>,
) -> Result<T, invite::InviteError> {
    payload
        .map(|Json(value)| value)
        .map_err(|_| invite::InviteError::validation("request_body_invalid"))
}

/// Query入力を検証して message 一覧クエリを取得する。
/// @param query Query 抽出結果
/// @returns 検証済みメッセージ一覧クエリ
/// @throws GuildChannelError Query 形式不正時
fn parse_message_list_query(
    query: Result<Query<ListGuildChannelMessagesQueryV1>, QueryRejection>,
) -> Result<ListGuildChannelMessagesQueryV1, GuildChannelError> {
    query
        .map(|Query(value)| value)
        .map_err(|_| GuildChannelError::validation("message_query_invalid"))
}

/// contract 固定用のメッセージ fixture を返す。
/// @param guild_id 対象 guild_id
/// @param channel_id 対象 channel_id
/// @returns newest-first のメッセージ列
/// @throws なし
#[cfg(test)]
fn message_fixture(guild_id: i64, channel_id: i64) -> Vec<linklynx_message_api::MessageItemV1> {
    vec![
        linklynx_message_api::MessageItemV1 {
            message_id: 120_110,
            guild_id,
            channel_id,
            author_id: 9001,
            content: "latest".to_owned(),
            created_at: "2026-02-21T10:00:06Z".to_owned(),
            version: 1,
            edited_at: None,
            is_deleted: false,
        },
        linklynx_message_api::MessageItemV1 {
            message_id: 120_108,
            guild_id,
            channel_id,
            author_id: 9002,
            content: "same-ts-newer".to_owned(),
            created_at: "2026-02-21T10:00:05Z".to_owned(),
            version: 1,
            edited_at: None,
            is_deleted: false,
        },
        linklynx_message_api::MessageItemV1 {
            message_id: 120_107,
            guild_id,
            channel_id,
            author_id: 9003,
            content: "same-ts-older".to_owned(),
            created_at: "2026-02-21T10:00:05Z".to_owned(),
            version: 1,
            edited_at: None,
            is_deleted: false,
        },
        linklynx_message_api::MessageItemV1 {
            message_id: 120_105,
            guild_id,
            channel_id,
            author_id: 9001,
            content: "older".to_owned(),
            created_at: "2026-02-21T10:00:04Z".to_owned(),
            version: 1,
            edited_at: None,
            is_deleted: false,
        },
        linklynx_message_api::MessageItemV1 {
            message_id: 120_102,
            guild_id,
            channel_id,
            author_id: 9002,
            content: "oldest".to_owned(),
            created_at: "2026-02-21T10:00:03Z".to_owned(),
            version: 1,
            edited_at: None,
            is_deleted: false,
        },
    ]
}

/// contract 固定用の作成レスポンス fixture を返す。
/// @param guild_id 対象 guild_id
/// @param channel_id 対象 channel_id
/// @param author_id 投稿主体
/// @param content 投稿内容
/// @returns メッセージスナップショット
/// @throws なし
#[cfg(test)]
fn create_message_fixture(
    guild_id: i64,
    channel_id: i64,
    author_id: i64,
    content: String,
) -> linklynx_message_api::MessageItemV1 {
    linklynx_message_api::MessageItemV1 {
        message_id: 120_111,
        guild_id,
        channel_id,
        author_id,
        content,
        created_at: "2026-03-07T10:00:00Z".to_owned(),
        version: 1,
        edited_at: None,
        is_deleted: false,
    }
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
    let banner_key = parse_nullable_string_patch_field(payload, "banner_key")?;
    let theme = parse_string_patch_field(payload, "theme")?;

    Ok(ProfilePatchInput {
        display_name,
        status_text,
        avatar_key,
        banner_key,
        theme,
    })
}

/// JSON入力を検証して profile media upload 発行入力を取得する。
/// @param payload JSON抽出結果
/// @returns 検証済み profile media upload 入力
/// @throws ProfileError JSON不正時
fn parse_profile_media_upload_payload(
    payload: Result<Json<ProfileMediaUploadUrlRequest>, JsonRejection>,
) -> Result<profile::ProfileMediaUploadInput, ProfileError> {
    let payload = payload
        .map(|Json(value)| value)
        .map_err(|_| ProfileError::validation("request_body_invalid"))?;
    Ok(profile::ProfileMediaUploadInput {
        target: profile::ProfileMediaTarget::parse(payload.target.as_str())?,
        filename: payload.filename,
        content_type: payload.content_type,
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
        Some(_) => Err(ProfileError::validation(format!(
            "{field_name}_invalid_type"
        ))),
        None => Ok(None),
    }
}

/// 必須null不可の文字列更新フィールドを解釈する。
/// @param payload リクエストJSONオブジェクト
/// @param field_name 対象フィールド名
/// @returns 更新値
/// @throws ProfileError 型不正またはnull入力時
fn parse_string_patch_field(
    payload: &serde_json::Map<String, serde_json::Value>,
    field_name: &str,
) -> Result<Option<String>, ProfileError> {
    match payload.get(field_name) {
        Some(serde_json::Value::String(value)) => Ok(Some(value.clone())),
        Some(serde_json::Value::Null) => Err(ProfileError::validation(format!(
            "{field_name}_null_not_allowed"
        ))),
        Some(_) => Err(ProfileError::validation(format!(
            "{field_name}_invalid_type"
        ))),
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

/// 公開invite用のレート制限キーを生成する。
/// @param client_scope 解決済み client scope
/// @returns レート制限キー
/// @throws なし
fn public_invite_rate_limit_key(client_scope: &PublicInviteClientScope) -> String {
    format!("public:{}:invite_access", client_scope.key_fragment)
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

/// permission snapshot を返す。
/// @param state アプリケーション状態
/// @param auth_context 認証文脈
/// @param params guild_id を含むパスパラメータ
/// @param query channel_id を含むクエリパラメータ
/// @returns permission snapshot レスポンス
/// @throws なし
async fn get_permission_snapshot(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(params): Path<GuildPathParams>,
    Query(query): Query<PermissionSnapshotQuery>,
) -> Response {
    let request_id = auth_context.request_id.clone();
    let guild_id = match parse_guild_id(&params.guild_id) {
        Ok(value) => value,
        Err(error) => return guild_channel_error_response(&error, request_id),
    };
    let channel_id = match parse_optional_channel_id(query.channel_id.as_deref()) {
        Ok(value) => value,
        Err(error) => {
            let audit = permission_snapshot_audit_fields(&auth_context, guild_id, None);
            tracing::warn!(
                decision = "deny",
                request_id = %request_id,
                principal_id = audit.principal_id,
                guild_id = audit.guild_id,
                channel_id = audit.channel_id,
                error_class = "validation_invalid_input",
                reason = %error.reason,
                action = audit.action,
                resource = audit.resource,
                decision_source = "request_validation",
                "permission snapshot rejected at request validation"
            );
            return guild_channel_error_response(&error, request_id);
        }
    };
    let audit = permission_snapshot_audit_fields(&auth_context, guild_id, channel_id);

    let guild_manage_future = resolve_permission_flag(
        Arc::clone(&state.authorizer),
        &auth_context,
        AuthzResource::Guild { guild_id },
        AuthzAction::Manage,
    );
    let channel_future = resolve_channel_permission_snapshot(
        Arc::clone(&state.authorizer),
        &auth_context,
        guild_id,
        channel_id,
    );

    let (guild_manage, channel) = match tokio::try_join!(guild_manage_future, channel_future) {
        Ok(values) => values,
        Err(error) => {
            tracing::warn!(
                decision = %error.decision(),
                request_id = %request_id,
                principal_id = audit.principal_id,
                guild_id = audit.guild_id,
                channel_id = audit.channel_id,
                error_class = %error.log_class(),
                reason = %error.reason,
                action = audit.action,
                resource = audit.resource,
                decision_source = audit.decision_source,
                "permission snapshot rejected"
            );
            return authz_error_response(&error, request_id);
        }
    };

    tracing::info!(
        decision = "allow",
        request_id = %request_id,
        principal_id = audit.principal_id,
        guild_id = audit.guild_id,
        channel_id = audit.channel_id,
        error_class = "none",
        action = audit.action,
        resource = audit.resource,
        decision_source = audit.decision_source,
        "permission snapshot returned"
    );

    Json(PermissionSnapshotResponse {
        request_id,
        snapshot: PermissionSnapshot {
            guild_id,
            channel_id,
            guild: GuildPermissionSnapshot {
                can_view: true,
                can_create_channel: guild_manage,
                can_create_invite: guild_manage,
                can_manage_settings: guild_manage,
                can_moderate: guild_manage,
            },
            channel,
        },
    })
    .into_response()
}

/// guild配下へinviteを作成する。
/// @param state アプリケーション状態
/// @param auth_context 認証文脈
/// @param params パスパラメータ
/// @param payload 作成入力
/// @returns 作成結果レスポンス
/// @throws なし
async fn create_guild_invite(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(params): Path<GuildPathParams>,
    payload: Result<Json<CreateInviteRequest>, JsonRejection>,
) -> Response {
    let request_id = auth_context.request_id.clone();
    let guild_id = match parse_guild_id(&params.guild_id) {
        Ok(value) => value,
        Err(error) => {
            return invite_error_response(
                &invite::InviteError::validation(error.reason),
                request_id,
            )
        }
    };
    let payload = match parse_invite_json_payload(payload) {
        Ok(value) => value,
        Err(error) => return invite_error_response(&error, request_id),
    };

    match state
        .invite_service
        .create_invite(
            auth_context.principal_id,
            guild_id,
            invite::CreateInviteInput {
                channel_id: payload.channel_id,
                max_age_seconds: payload.max_age_seconds,
                max_uses: payload.max_uses,
            },
        )
        .await
    {
        Ok(invite) => (StatusCode::CREATED, Json(CreateInviteResponse {
            ok: true,
            request_id,
            invite,
        }))
            .into_response(),
        Err(error) => invite_error_response(&error, request_id),
    }
}

/// guild配下の招待を取り消す。
/// @param state アプリケーション状態
/// @param auth_context 認証文脈
/// @param params パスパラメータ
/// @returns 取消結果
/// @throws なし
async fn revoke_guild_invite(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(params): Path<GuildInvitePathParams>,
) -> Response {
    let request_id = auth_context.request_id.clone();
    let guild_id = match parse_guild_id(&params.guild_id) {
        Ok(value) => value,
        Err(error) => {
            return invite_error_response(
                &invite::InviteError::validation(error.reason),
                request_id,
            )
        }
    };

    match state
        .invite_service
        .revoke_invite(auth_context.principal_id, guild_id, params.invite_code)
        .await
    {
        Ok(()) => StatusCode::NO_CONTENT.into_response(),
        Err(error) => invite_error_response(&error, request_id),
    }
}

/// permission snapshot 監査ログの共通項目を返す。
/// @param auth_context 認証文脈
/// @param guild_id 対象guild_id
/// @param channel_id 対象channel_id
/// @returns 監査ログ項目
/// @throws なし
fn permission_snapshot_audit_fields(
    auth_context: &AuthContext,
    guild_id: i64,
    channel_id: Option<i64>,
) -> PermissionSnapshotAuditFields {
    PermissionSnapshotAuditFields {
        principal_id: auth_context.principal_id.0,
        guild_id,
        channel_id,
        action: "view",
        resource: "permission_snapshot",
        decision_source: "permission_snapshot_handler",
    }
}

/// permission boolean を解決する。
/// @param authorizer 認可境界
/// @param auth_context 認証文脈
/// @param resource 認可対象
/// @param action 認可操作
/// @returns allow=bool、deny=false
/// @throws AuthzError dependency unavailable 時
async fn resolve_permission_flag(
    authorizer: Arc<dyn Authorizer>,
    auth_context: &AuthContext,
    resource: AuthzResource,
    action: AuthzAction,
) -> Result<bool, authz::AuthzError> {
    let input = AuthzCheckInput {
        principal_id: auth_context.principal_id,
        resource,
        action,
    };

    match authorizer.check(&input).await {
        Ok(()) => Ok(true),
        Err(error) if matches!(error.kind, AuthzErrorKind::Denied) => Ok(false),
        Err(error) => Err(error),
    }
}

/// channel permission snapshot を解決する。
/// @param authorizer 認可境界
/// @param auth_context 認証文脈
/// @param guild_id 所属guild ID
/// @param channel_id 対象channel ID。未指定時は `None`
/// @returns channel snapshot。channel 未指定時は `None`
/// @throws AuthzError dependency unavailable 時
async fn resolve_channel_permission_snapshot(
    authorizer: Arc<dyn Authorizer>,
    auth_context: &AuthContext,
    guild_id: i64,
    channel_id: Option<i64>,
) -> Result<Option<ChannelPermissionSnapshot>, authz::AuthzError> {
    let Some(channel_id) = channel_id else {
        return Ok(None);
    };

    let can_view_future = resolve_permission_flag(
        Arc::clone(&authorizer),
        auth_context,
        AuthzResource::GuildChannel {
            guild_id,
            channel_id,
        },
        AuthzAction::View,
    );
    let can_post_future = resolve_permission_flag(
        Arc::clone(&authorizer),
        auth_context,
        AuthzResource::GuildChannel {
            guild_id,
            channel_id,
        },
        AuthzAction::Post,
    );
    let can_manage_future = resolve_permission_flag(
        authorizer,
        auth_context,
        AuthzResource::GuildChannel {
            guild_id,
            channel_id,
        },
        AuthzAction::Manage,
    );

    let (can_view, can_post, can_manage) =
        tokio::try_join!(can_view_future, can_post_future, can_manage_future)?;

    Ok(Some(ChannelPermissionSnapshot {
        can_view,
        can_post,
        can_manage,
    }))
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
        .create_guild_channel(
            auth_context.principal_id,
            guild_id,
            guild_channel::CreateChannelInput {
                name: payload.name,
                kind: payload
                    .r#type
                    .unwrap_or(guild_channel::ChannelKind::GuildText),
                parent_id: payload.parent_id,
            },
        )
        .await
    {
        Ok(channel) => {
            (StatusCode::CREATED, Json(ChannelCreateResponse { channel })).into_response()
        }
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
    let target_type = match moderation::ModerationTargetType::parse_api_label(&payload.target_type)
    {
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
        Ok(report) => (
            StatusCode::CREATED,
            Json(ModerationReportResponse { report }),
        )
            .into_response(),
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

    match state
        .profile_service
        .get_profile(auth_context.principal_id)
        .await
    {
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

/// 認証済みprincipal向けのプロフィール画像アップロードURLを発行する。
/// @param state アプリケーション状態
/// @param auth_context 認証文脈
/// @param payload 発行入力
/// @returns アップロードURLレスポンス
/// @throws なし
async fn issue_my_profile_media_upload_url(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    payload: Result<Json<ProfileMediaUploadUrlRequest>, JsonRejection>,
) -> Response {
    let request_id = auth_context.request_id.clone();
    let input = match parse_profile_media_upload_payload(payload) {
        Ok(value) => value,
        Err(error) => return profile_error_response(&error, request_id),
    };

    match state
        .profile_media_service
        .issue_upload_url(auth_context.principal_id, input)
        .await
    {
        Ok(upload) => Json(ProfileMediaUploadUrlResponse { upload }).into_response(),
        Err(error) => profile_error_response(&error, request_id),
    }
}

/// 認証済みprincipal向けのプロフィール画像ダウンロードURLを発行する。
/// @param state アプリケーション状態
/// @param auth_context 認証文脈
/// @param params パスパラメータ
/// @returns ダウンロードURLレスポンス
/// @throws なし
async fn get_my_profile_media_download_url(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(params): Path<ProfileMediaTargetPathParams>,
) -> Response {
    let request_id = auth_context.request_id.clone();
    let target = match profile::ProfileMediaTarget::parse(params.target.as_str()) {
        Ok(value) => value,
        Err(error) => return profile_error_response(&error, request_id),
    };

    match state
        .profile_media_service
        .issue_download_url(auth_context.principal_id, target)
        .await
    {
        Ok(media) => Json(ProfileMediaDownloadUrlResponse { media }).into_response(),
        Err(error) => profile_error_response(&error, request_id),
    }
}

/// 他ユーザープロフィールを返す。
/// @param state アプリケーション状態
/// @param auth_context 認証文脈
/// @param params user_id を含むパスパラメータ
/// @returns user profile レスポンス
/// @throws なし
async fn get_user_profile(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(params): Path<UserPathParams>,
) -> Response {
    let request_id = auth_context.request_id.clone();
    let user_id = match parse_user_id(&params.user_id) {
        Ok(value) => value,
        Err(error) => return user_directory_error_response(&error, request_id),
    };

    match state
        .user_directory_service
        .get_user_profile(auth_context.principal_id, user_id)
        .await
    {
        Ok(profile) => Json(UserProfileResponse { profile }).into_response(),
        Err(error) => user_directory_error_response(&error, request_id),
    }
}

/// guild member 一覧を返す。
/// @param state アプリケーション状態
/// @param auth_context 認証文脈
/// @param params guild_id を含むパスパラメータ
/// @returns guild member 一覧レスポンス
/// @throws なし
async fn get_guild_members(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(params): Path<GuildPathParams>,
) -> Response {
    let request_id = auth_context.request_id.clone();
    let guild_id = match parse_user_directory_guild_id(&params.guild_id) {
        Ok(value) => value,
        Err(error) => return user_directory_error_response(&error, request_id),
    };

    match state
        .user_directory_service
        .list_guild_members(auth_context.principal_id, guild_id)
        .await
    {
        Ok(members) => Json(GuildMembersResponse { members }).into_response(),
        Err(error) => user_directory_error_response(&error, request_id),
    }
}

/// guild role 一覧を返す。
/// @param state アプリケーション状態
/// @param auth_context 認証文脈
/// @param params guild_id を含むパスパラメータ
/// @returns guild role 一覧レスポンス
/// @throws なし
async fn get_guild_roles(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(params): Path<GuildPathParams>,
) -> Response {
    let request_id = auth_context.request_id.clone();
    let guild_id = match parse_user_directory_guild_id(&params.guild_id) {
        Ok(value) => value,
        Err(error) => return user_directory_error_response(&error, request_id),
    };

    match state
        .user_directory_service
        .list_guild_roles(auth_context.principal_id, guild_id)
        .await
    {
        Ok(roles) => Json(GuildRolesResponse { roles }).into_response(),
        Err(error) => user_directory_error_response(&error, request_id),
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
    let request_scope = rest_request_scope_from_path(&request_path);

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

    if let Some(rate_limit_action) =
        rest_rate_limit_action_for_request(&request_method, &request_path)
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
                guild_id = request_scope.guild_id,
                channel_id = request_scope.channel_id,
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
            guild_id = request_scope.guild_id,
            channel_id = request_scope.channel_id,
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
    if *method == axum::http::Method::POST && is_guild_invite_create_path(path) {
        return AuthzAction::Manage;
    }
    if is_message_command_path(path)
        && (*method == axum::http::Method::PATCH || *method == axum::http::Method::DELETE)
    {
        return AuthzAction::Post;
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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct RestRequestScope {
    guild_id: Option<i64>,
    channel_id: Option<i64>,
}

/// RESTパスから監査用の scope 情報を抽出する。
/// @param path リクエストパス
/// @returns guild/channel scope
/// @throws なし
fn rest_request_scope_from_path(path: &str) -> RestRequestScope {
    if let Some((guild_id, channel_id)) = parse_guild_channel_path(path) {
        return RestRequestScope {
            guild_id: Some(guild_id),
            channel_id: Some(channel_id),
        };
    }
    if let Some(channel_id) = parse_dm_channel_path(path) {
        return RestRequestScope {
            guild_id: None,
            channel_id: Some(channel_id),
        };
    }
    if let Some(guild_id) = parse_guild_invite_path(path) {
        return RestRequestScope {
            guild_id: Some(guild_id),
            channel_id: None,
        };
    }
    if let Some(guild_id) = parse_moderation_guild_path(path) {
        return RestRequestScope {
            guild_id: Some(guild_id),
            channel_id: None,
        };
    }
    if let Some(guild_id) = parse_guild_path(path) {
        return RestRequestScope {
            guild_id: Some(guild_id),
            channel_id: None,
        };
    }

    RestRequestScope {
        guild_id: None,
        channel_id: None,
    }
}

fn is_message_command_path(path: &str) -> bool {
    path.starts_with("/v1/guilds/") && path.contains("/channels/") && path.contains("/messages/")
}

/// ギルドパスから guild_id を抽出する。
/// @param path リクエストパス
/// @returns guild_id
/// @throws なし
fn parse_guild_path(path: &str) -> Option<i64> {
    let segments = path.trim_matches('/').split('/').collect::<Vec<_>>();
    match segments.as_slice() {
        ["guilds", guild_id] => guild_id.parse::<i64>().ok(),
        ["guilds", guild_id, "permission-snapshot"] => guild_id.parse::<i64>().ok(),
        ["v1", "guilds", guild_id] => guild_id.parse::<i64>().ok(),
        _ => None,
    }
}

/// ギルドチャンネルパスから guild_id/channel_id を抽出する。
/// @param path リクエストパス
/// @returns guild_id と channel_id
/// @throws なし
fn parse_guild_channel_path(path: &str) -> Option<(i64, i64)> {
    let segments = path.trim_matches('/').split('/').collect::<Vec<_>>();
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
    match segments.as_slice() {
        ["v1", "guilds", guild_id, "invites"]
        | ["v1", "guilds", guild_id, "invites", _] => guild_id.parse::<i64>().ok(),
        _ => None,
    }
}

fn is_guild_invite_create_path(path: &str) -> bool {
    let segments = path.trim_matches('/').split('/').collect::<Vec<_>>();
    matches!(segments.as_slice(), ["v1", "guilds", _, "invites"])
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
