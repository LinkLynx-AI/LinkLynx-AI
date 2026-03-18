#[derive(Debug, Deserialize, Default)]
struct WsConnectQuery {
    ticket: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
enum ClientWsMessage {
    #[serde(rename = "auth.identify")]
    Identify { d: WsIdentifyPayload },
    #[serde(rename = "auth.reauthenticate")]
    Reauthenticate { d: WsReauthenticatePayload },
}

#[derive(Debug, Deserialize, Clone)]
struct WsIdentifyPayload {
    method: String,
    ticket: String,
}

#[derive(Debug, Deserialize)]
struct WsReauthenticatePayload {
    #[serde(rename = "idToken")]
    id_token: String,
}

#[derive(Debug, Serialize)]
struct WsAuthReady<'a> {
    #[serde(rename = "type")]
    message_type: &'a str,
    d: WsAuthReadyData,
}

#[derive(Debug, Serialize)]
struct WsAuthReadyData {
    #[serde(rename = "principalId")]
    principal_id: i64,
}

#[derive(Debug, Serialize)]
struct WsReauthenticateRequest<'a> {
    #[serde(rename = "type")]
    message_type: &'a str,
    deadline_epoch: u64,
    request_id: &'a str,
}

#[derive(Debug, Serialize)]
struct WsReauthenticateAck<'a> {
    #[serde(rename = "type")]
    message_type: &'a str,
    principal_id: i64,
    request_id: &'a str,
}

#[derive(Debug, Serialize)]
struct WsHandshakeErrorBody {
    code: &'static str,
    message: &'static str,
    request_id: String,
}

struct ReadyMessageContext<'a> {
    state: &'a AppState,
    authenticated: &'a mut AuthenticatedPrincipal,
    session_id: &'a str,
    outbound_tx: &'a tokio::sync::mpsc::Sender<ServerMessageFrameV1>,
    request_id: &'a str,
    reauth_deadline: &'a mut Option<Instant>,
}

/// WS接続ハンドシェイクを処理する。
/// @param state アプリケーション状態
/// @param headers HTTPヘッダー
/// @param query クエリ文字列
/// @param ws WSアップグレード
/// @returns ハンドシェイク応答
/// @throws なし
async fn ws_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<WsConnectQuery>,
    ws: WebSocketUpgrade,
) -> Response {
    let request_id = request_id_from_headers(&headers);
    let origin_header = headers.get("origin").and_then(|value| value.to_str().ok());
    if !state.ws_origin_allowlist.is_allowed(origin_header) {
        tracing::warn!(
            decision = "deny",
            request_id = %request_id,
            error_class = "origin_not_allowed",
            reason = if origin_header.is_some() {
                "ws_origin_not_allowed"
            } else {
                "ws_origin_missing"
            },
            has_origin = origin_header.is_some(),
            "WS connection rejected by origin allowlist"
        );
        return ws_handshake_error_response(
            StatusCode::FORBIDDEN,
            "AUTH_ORIGIN_NOT_ALLOWED",
            "origin is not allowed",
            request_id,
        );
    }

    let identify_rate_key = identify_rate_limit_key(origin_header);
    let auth_header_present = headers.contains_key(axum::http::header::AUTHORIZATION);

    let header_token = if auth_header_present {
        match bearer_token_from_headers(&headers) {
            Ok(token) => Some(token),
            Err(error) => {
                if auth_error_counts_toward_attempt_limit(&error) {
                    if let Some(response) =
                        enforce_auth_attempt_rate_limit(
                            &state,
                            &request_id,
                            &auth_attempt_rate_limit_key(&headers, None),
                        )
                        .await
                    {
                        return response;
                    }
                }
                tracing::warn!(
                    decision = %error.decision(),
                    request_id = %request_id,
                    error_class = %error.log_class(),
                    reason = %error.reason,
                    "WS auth rejected at header parsing"
                );
                return ws_upgrade_with_auth_error(ws, &error);
            }
        }
    } else {
        None
    };

    let query_ticket_raw = query.ticket.as_deref();
    let query_ticket = query_ticket_raw
        .map(str::trim)
        .filter(|value| !value.is_empty());

    if query_ticket.is_some() && !state.ws_query_ticket_enabled {
        tracing::warn!(
            decision = "deny",
            request_id = %request_id,
            error_class = "query_ticket_disabled",
            reason = "ws_query_ticket_disabled",
            "WS query-ticket authentication rejected"
        );
        return ws_upgrade_with_close(ws, 1008, "query_ticket_disabled");
    }

    if query_ticket_raw.is_some() && query_ticket.is_none() && header_token.is_none() {
        return ws_upgrade_with_close(ws, 1008, "identify_invalid_ticket");
    }

    if let Some(token) = header_token {
        let authenticated = match state.auth_service.authenticate_token(&token).await {
            Ok(authenticated) => authenticated,
            Err(error) => {
                if auth_error_counts_toward_attempt_limit(&error) {
                    if let Some(response) =
                        enforce_auth_attempt_rate_limit(
                            &state,
                            &request_id,
                            &auth_attempt_rate_limit_key(&headers, Some(&token)),
                        )
                        .await
                    {
                        return response;
                    }
                }
                tracing::warn!(
                    decision = %error.decision(),
                    request_id = %request_id,
                    error_class = %error.log_class(),
                    reason = %error.reason,
                    "WS auth rejected at handshake"
                );
                return ws_upgrade_with_auth_error(ws, &error);
            }
        };

        if let Err(error) = check_ws_connect_authorization(&state, &request_id, &authenticated).await {
            return ws_upgrade_with_close(ws, error.ws_close_code(), error.app_code());
        }

        tracing::info!(
            decision = "allow",
            request_id = %request_id,
            principal_id = authenticated.principal_id.0,
            firebase_uid = %authenticated.firebase_uid,
            email_verified = true,
            "WS auth accepted at handshake"
        );

        return ws
            .on_upgrade(move |socket| {
                handle_socket(
                    socket,
                    state,
                    Some(authenticated),
                    request_id,
                    identify_rate_key,
                    None,
                )
            })
            .into_response();
    }

    if let Some(ticket) = query_ticket {
        let authenticated = match state.ws_ticket_store.consume_ticket(ticket).await {
            Ok(authenticated) => authenticated,
            Err(error) => {
                let reason = match error {
                    auth::WsTicketConsumeError::Invalid => "identify_invalid_ticket",
                    auth::WsTicketConsumeError::Expired => "identify_ticket_expired",
                    auth::WsTicketConsumeError::AlreadyUsed => "identify_ticket_replayed",
                };
                tracing::warn!(
                    decision = "deny",
                    request_id = %request_id,
                    error_class = "ticket_rejected",
                    reason = %reason,
                    "WS ticket query authentication rejected"
                );
                return ws_upgrade_with_close(ws, 1008, reason);
            }
        };

        if let Err(error) = check_ws_connect_authorization(&state, &request_id, &authenticated).await {
            return ws_upgrade_with_close(ws, error.ws_close_code(), error.app_code());
        }

        tracing::info!(
            decision = "allow",
            request_id = %request_id,
            principal_id = authenticated.principal_id.0,
            firebase_uid = %authenticated.firebase_uid,
            email_verified = true,
            "WS auth accepted by query ticket"
        );

        return ws
            .on_upgrade(move |socket| {
                handle_socket(
                    socket,
                    state,
                    Some(authenticated),
                    request_id,
                    identify_rate_key,
                    None,
                )
            })
            .into_response();
    }

    let Some(preauth_permit) = try_acquire_ws_preauth_permit(&state, &request_id) else {
        return ws_upgrade_with_close(ws, 1008, "preauth_connection_limited");
    };

    ws.on_upgrade(move |socket| {
        handle_socket(
            socket,
            state,
            None,
            request_id,
            identify_rate_key,
            Some(preauth_permit),
        )
    })
        .into_response()
}

/// WSセッションを処理する。
/// @param socket WebSocket接続
/// @param state アプリケーション状態
/// @param authenticated 認証済み主体
/// @param request_id 接続識別子
/// @param identify_rate_key Identifyレートリミットキー
/// @returns なし
/// @throws なし
async fn handle_socket(
    mut socket: WebSocket,
    state: AppState,
    mut authenticated: Option<AuthenticatedPrincipal>,
    request_id: String,
    identify_rate_key: String,
    mut preauth_permit: Option<OwnedSemaphorePermit>,
) {
    let session_id = uuid::Uuid::new_v4().to_string();
    let (outbound_tx, mut outbound_rx) =
        tokio::sync::mpsc::channel::<ServerMessageFrameV1>(MESSAGE_REALTIME_OUTBOUND_CAPACITY);
    let mut identify_deadline = authenticated
        .is_none()
        .then_some(Instant::now() + state.auth_identify_timeout);
    let mut reauth_deadline: Option<Instant> = None;

    loop {
        if authenticated.is_none() {
            let Some(deadline) = identify_deadline else {
                let _ = close_socket(&mut socket, 1008, "identify_required").await;
                break;
            };

            if Instant::now() >= deadline {
                state.auth_service.metrics().record_ws_preauth_timeout();
                let _ = close_socket(&mut socket, 1008, "identify_timeout").await;
                break;
            }

            let timeout = deadline.saturating_duration_since(Instant::now());
            tokio::select! {
                incoming = socket.recv() => {
                    let Some(incoming) = incoming else {
                        break;
                    };
                    let Ok(message) = incoming else {
                        break;
                    };

                    let should_continue = handle_identify_message(
                        &state,
                        &mut socket,
                        &mut authenticated,
                        &request_id,
                        &identify_rate_key,
                        message,
                    ).await;

                    if !should_continue {
                        break;
                    }
                    if authenticated.is_some() {
                        if preauth_permit.take().is_some() {
                            state.auth_service.metrics().record_ws_preauth_close();
                        }
                        identify_deadline = None;
                    }
                }
                _ = tokio::time::sleep(timeout) => {
                    state.auth_service.metrics().record_ws_preauth_timeout();
                    let _ = close_socket(&mut socket, 1008, "identify_timeout").await;
                    break;
                }
            }
            continue;
        }

        let Some(authenticated_ref) = authenticated.as_mut() else {
            let _ = close_socket(&mut socket, 1008, "identify_required").await;
            break;
        };

        if let Some(deadline) = reauth_deadline {
            if Instant::now() >= deadline {
                state.auth_service.metrics().record_ws_reauth(false);
                let _ = close_socket(&mut socket, 1008, "reauth_timeout").await;
                break;
            }

            let timeout = deadline.saturating_duration_since(Instant::now());
            tokio::select! {
                incoming = socket.recv() => {
                    let Some(incoming) = incoming else {
                        break;
                    };

                    let Ok(message) = incoming else {
                        break;
                    };

                    let should_continue = handle_ready_message(
                        &mut socket,
                        ReadyMessageContext {
                            state: &state,
                            authenticated: authenticated_ref,
                            session_id: &session_id,
                            outbound_tx: &outbound_tx,
                            request_id: &request_id,
                            reauth_deadline: &mut reauth_deadline,
                        },
                        message,
                    ).await;

                    if !should_continue {
                        break;
                    }
                }
                _ = tokio::time::sleep(timeout) => {
                    state.auth_service.metrics().record_ws_reauth(false);
                    let _ = close_socket(&mut socket, 1008, "reauth_timeout").await;
                    break;
                }
            }
            continue;
        }

        let now = unix_timestamp_seconds();
        if now >= authenticated_ref.expires_at_epoch {
            let deadline_epoch = now + state.ws_reauth_grace.as_secs();
            let request = WsReauthenticateRequest {
                message_type: "auth.reauthenticate",
                deadline_epoch,
                request_id: &request_id,
            };

            if send_json_message(&mut socket, &request).await.is_err() {
                break;
            }

            reauth_deadline = Some(Instant::now() + state.ws_reauth_grace);
            continue;
        }

        let wait_until_expired = Duration::from_secs(authenticated_ref.expires_at_epoch - now);
        tokio::select! {
            incoming = socket.recv() => {
                let Some(incoming) = incoming else {
                    break;
                };

                let Ok(message) = incoming else {
                    break;
                };

                let should_continue = handle_ready_message(
                    &mut socket,
                    ReadyMessageContext {
                        state: &state,
                        authenticated: authenticated_ref,
                        session_id: &session_id,
                        outbound_tx: &outbound_tx,
                        request_id: &request_id,
                        reauth_deadline: &mut reauth_deadline,
                    },
                    message,
                ).await;

                if !should_continue {
                    break;
                }
            }
            outbound = outbound_rx.recv() => {
                let Some(frame) = outbound else {
                    break;
                };
                if send_json_message(&mut socket, &frame).await.is_err() {
                    break;
                }
            }
            _ = tokio::time::sleep(wait_until_expired) => {}
        }
    }

    if preauth_permit.take().is_some() {
        state.auth_service.metrics().record_ws_preauth_close();
    }

    state
        .message_realtime_hub
        .disconnect_session(&session_id)
        .await;
}

/// Identify待機中メッセージを処理する。
/// @param state アプリケーション状態
/// @param socket WebSocket接続
/// @param authenticated 認証済み主体
/// @param request_id 接続識別子
/// @param identify_rate_key Identifyレートリミットキー
/// @param message 受信メッセージ
/// @returns 継続可否
/// @throws なし
async fn handle_identify_message(
    state: &AppState,
    socket: &mut WebSocket,
    authenticated: &mut Option<AuthenticatedPrincipal>,
    request_id: &str,
    identify_rate_key: &str,
    message: Message,
) -> bool {
    match message {
        Message::Text(text) => {
            let text = text.to_string();
            if text.len() > state.ws_preauth_message_max_bytes {
                tracing::warn!(
                    decision = "deny",
                    request_id = %request_id,
                    error_class = "payload_too_large",
                    reason = "identify_message_too_large",
                    max_bytes = state.ws_preauth_message_max_bytes,
                    observed_bytes = text.len(),
                    "WS identify rejected due to oversized payload"
                );
                let _ = close_socket(socket, 1009, "message_too_large").await;
                return false;
            }
            let Some(payload) = parse_identify_payload(&text) else {
                let _ = close_socket(socket, 1008, "identify_required").await;
                return false;
            };

            if !payload.method.eq_ignore_ascii_case("ticket") || payload.ticket.trim().is_empty() {
                let _ = close_socket(socket, 1008, "identify_invalid_payload").await;
                return false;
            }

            if !state
                .ws_identify_rate_limiter
                .check_and_record(identify_rate_key)
                .await
            {
                tracing::warn!(
                    decision = "deny",
                    request_id = %request_id,
                    error_class = "rate_limited",
                    reason = "identify_rate_limited",
                    "WS identify rejected by rate limit"
                );
                let _ = close_socket(socket, 1008, "identify_rate_limited").await;
                return false;
            }

            let next_principal = match state
                .ws_ticket_store
                .consume_ticket(payload.ticket.trim())
                .await
            {
                Ok(principal) => principal,
                Err(error) => {
                    let reason = match error {
                        auth::WsTicketConsumeError::Invalid => "identify_invalid_ticket",
                        auth::WsTicketConsumeError::Expired => "identify_ticket_expired",
                        auth::WsTicketConsumeError::AlreadyUsed => "identify_ticket_replayed",
                    };
                    tracing::warn!(
                        decision = "deny",
                        request_id = %request_id,
                        error_class = "ticket_rejected",
                        reason = %reason,
                        "WS identify rejected"
                    );
                    let _ = close_socket(socket, 1008, reason).await;
                    return false;
                }
            };

            if let Err(error) = check_ws_connect_authorization(state, request_id, &next_principal).await {
                let _ = close_socket(socket, error.ws_close_code(), error.app_code()).await;
                return false;
            }

            let ready = WsAuthReady {
                message_type: "auth.ready",
                d: WsAuthReadyData {
                    principal_id: next_principal.principal_id.0,
                },
            };
            if send_json_message(socket, &ready).await.is_err() {
                return false;
            }

            tracing::info!(
                decision = "allow",
                request_id = %request_id,
                principal_id = next_principal.principal_id.0,
                firebase_uid = %next_principal.firebase_uid,
                email_verified = true,
                "WS auth accepted by identify"
            );
            *authenticated = Some(next_principal);
            true
        }
        Message::Binary(payload) => {
            if payload.len() > state.ws_preauth_message_max_bytes {
                tracing::warn!(
                    decision = "deny",
                    request_id = %request_id,
                    error_class = "payload_too_large",
                    reason = "identify_message_too_large",
                    max_bytes = state.ws_preauth_message_max_bytes,
                    observed_bytes = payload.len(),
                    "WS identify rejected due to oversized binary payload"
                );
                let _ = close_socket(socket, 1009, "message_too_large").await;
                return false;
            }
            let _ = close_socket(socket, 1008, "identify_required").await;
            false
        }
        Message::Ping(payload) => socket.send(Message::Pong(payload)).await.is_ok(),
        Message::Pong(_) => true,
        Message::Close(_) => false,
    }
}

/// 認証完了後メッセージを処理する。
/// @param state アプリケーション状態
/// @param socket WebSocket接続
/// @param authenticated 認証済み主体
/// @param request_id 接続識別子
/// @param reauth_deadline 再認証期限
/// @param message 受信メッセージ
/// @returns 継続可否
/// @throws なし
async fn handle_ready_message(
    socket: &mut WebSocket,
    context: ReadyMessageContext<'_>,
    message: Message,
) -> bool {
    let ReadyMessageContext {
        state,
        authenticated,
        session_id,
        outbound_tx,
        request_id,
        reauth_deadline,
    } = context;
    match message {
        Message::Text(text) => {
            let text = text.to_string();

            if matches!(parse_client_ws_message(&text), Some(ClientWsMessage::Identify { .. })) {
                let _ = close_socket(socket, 1008, "unexpected_identify").await;
                return false;
            }

            if parse_reauth_id_token(&text).is_none() {
                if reauth_deadline.is_some() {
                    state.auth_service.metrics().record_ws_reauth(false);
                    let _ = close_socket(socket, 1008, "reauth_required").await;
                    return false;
                }

                if let Some(frame) = parse_message_client_frame(&text) {
                    if !authorize_message_frame_operation(
                        state,
                        authenticated,
                        request_id,
                        socket,
                        &frame,
                    )
                    .await
                    {
                        return false;
                    }
                    return handle_message_frame(
                        state,
                        socket,
                        authenticated.principal_id,
                        session_id,
                        outbound_tx,
                        frame,
                    )
                    .await;
                }

                if !authorize_ws_stream_operation(state, authenticated, request_id, socket).await {
                    return false;
                }
                return socket.send(Message::Text(text.into())).await.is_ok();
            }

            let Some(token) = parse_reauth_id_token(&text) else {
                state.auth_service.metrics().record_ws_reauth(false);
                let _ = close_socket(socket, 1008, "reauth_required").await;
                return false;
            };

            match state.auth_service.authenticate_token(&token).await {
                Ok(next_principal) => {
                    if let Err(error) =
                        check_ws_connect_authorization(state, request_id, &next_principal).await
                    {
                        state.auth_service.metrics().record_ws_reauth(false);
                        let _ = close_socket(socket, error.ws_close_code(), error.app_code()).await;
                        return false;
                    }

                    if next_principal.principal_id != authenticated.principal_id {
                        state.auth_service.metrics().record_ws_reauth(false);
                        tracing::warn!(
                            decision = "deny",
                            request_id = %request_id,
                            error_class = "principal_changed",
                            reason = "principal_changed",
                            "WS reauth rejected"
                        );
                        let _ = close_socket(socket, 1008, "principal_changed").await;
                        return false;
                    }

                    *authenticated = next_principal;
                    state
                        .message_realtime_hub
                        .reconcile_session_subscriptions(
                            state,
                            session_id,
                            authenticated.principal_id,
                        )
                        .await;
                    *reauth_deadline = None;
                    state.auth_service.metrics().record_ws_reauth(true);
                    tracing::info!(
                        decision = "allow",
                        request_id = %request_id,
                        principal_id = authenticated.principal_id.0,
                        firebase_uid = %authenticated.firebase_uid,
                        email_verified = true,
                        "WS reauth accepted"
                    );

                    let ack = WsReauthenticateAck {
                        message_type: "auth.reauthenticated",
                        principal_id: authenticated.principal_id.0,
                        request_id,
                    };

                    send_json_message(socket, &ack).await.is_ok()
                }
                Err(error) => {
                    state.auth_service.metrics().record_ws_reauth(false);
                    tracing::warn!(
                        decision = %error.decision(),
                        request_id = %request_id,
                        error_class = %error.log_class(),
                        reason = %error.reason,
                        "WS reauth rejected"
                    );
                    let _ = close_socket(socket, error.ws_close_code(), error.app_code()).await;
                    false
                }
            }
        }
        Message::Binary(_) => {
            if reauth_deadline.is_some() {
                state.auth_service.metrics().record_ws_reauth(false);
                let _ = close_socket(socket, 1008, "reauth_required").await;
                return false;
            }
            if !authorize_ws_stream_operation(state, authenticated, request_id, socket).await {
                return false;
            }
            true
        }
        Message::Ping(payload) => socket.send(Message::Pong(payload)).await.is_ok(),
        Message::Pong(_) => true,
        Message::Close(_) => false,
    }
}

async fn check_ws_connect_authorization(
    state: &AppState,
    request_id: &str,
    authenticated: &AuthenticatedPrincipal,
) -> Result<(), authz::AuthzError> {
    let authz_input = AuthzCheckInput {
        principal_id: authenticated.principal_id,
        resource: AuthzResource::Session,
        action: AuthzAction::Connect,
    };
    if let Err(error) = state.authorizer.check(&authz_input).await {
        state.authz_metrics.record_error(&error);
        tracing::warn!(
            decision = %error.decision(),
            request_id = %request_id,
            principal_id = authenticated.principal_id.0,
            error_class = %error.log_class(),
            reason = %error.reason,
            resource = "session",
            action = "connect",
            decision_source = "authorizer",
            "WS authz rejected"
        );
        return Err(error);
    }
    state.authz_metrics.record_allow();

    Ok(())
}

/// テキストメッセージをWSクライアントメッセージとして解釈する。
/// @param text クライアント送信テキスト
/// @returns 解釈済みメッセージ
/// @throws なし
fn parse_client_ws_message(text: &str) -> Option<ClientWsMessage> {
    serde_json::from_str::<ClientWsMessage>(text).ok()
}

/// テキストメッセージからidentify payloadを抽出する。
/// @param text クライアント送信テキスト
/// @returns identify payload
/// @throws なし
fn parse_identify_payload(text: &str) -> Option<WsIdentifyPayload> {
    match parse_client_ws_message(text) {
        Some(ClientWsMessage::Identify { d }) => Some(d),
        _ => None,
    }
}

/// テキストメッセージから再認証トークンを抽出する。
/// @param text クライアント送信テキスト
/// @returns 再認証トークン（存在時）
/// @throws なし
fn parse_reauth_id_token(text: &str) -> Option<String> {
    match parse_client_ws_message(text) {
        Some(ClientWsMessage::Reauthenticate { d }) => Some(d.id_token),
        _ => None,
    }
}

/// テキストメッセージを message WS frame として解釈する。
/// @param text クライアント送信テキスト
/// @returns 解釈済み message frame
/// @throws なし
fn parse_message_client_frame(text: &str) -> Option<ClientMessageFrameV1> {
    serde_json::from_str::<ClientMessageFrameV1>(text).ok()
}

fn build_message_server_frame(frame: ClientMessageFrameV1) -> ServerMessageFrameV1 {
    match frame {
        ClientMessageFrameV1::Subscribe(target) => {
            ServerMessageFrameV1::Subscribed(MessageSubscriptionStateV1::from(target))
        }
        ClientMessageFrameV1::Unsubscribe(target) => {
            ServerMessageFrameV1::Unsubscribed(MessageSubscriptionStateV1::from(target))
        }
        ClientMessageFrameV1::DmSubscribe(target) => {
            ServerMessageFrameV1::DmSubscribed(DmMessageSubscriptionStateV1::from(target))
        }
        ClientMessageFrameV1::DmUnsubscribe(target) => {
            ServerMessageFrameV1::DmUnsubscribed(DmMessageSubscriptionStateV1::from(target))
        }
    }
}

/// 認可済み message frame を購読状態へ反映し、ACK を返す。
/// @param state アプリケーション状態
/// @param socket WebSocket接続
/// @param session_id WS セッション識別子
/// @param outbound_tx セッション outbound sender
/// @param frame 認可済み message frame
/// @returns 継続可否
/// @throws なし
async fn handle_message_frame(
    state: &AppState,
    socket: &mut WebSocket,
    principal_id: PrincipalId,
    session_id: &str,
    outbound_tx: &tokio::sync::mpsc::Sender<ServerMessageFrameV1>,
    frame: ClientMessageFrameV1,
) -> bool {
    match &frame {
        ClientMessageFrameV1::Subscribe(target) => {
            state
                .message_realtime_hub
                .subscribe(session_id, principal_id, target, outbound_tx.clone())
                .await;
        }
        ClientMessageFrameV1::Unsubscribe(target) => {
            state
                .message_realtime_hub
                .unsubscribe(session_id, target)
                .await;
        }
        ClientMessageFrameV1::DmSubscribe(target) => {
            state
                .message_realtime_hub
                .subscribe_dm(session_id, principal_id, target, outbound_tx.clone())
                .await;
        }
        ClientMessageFrameV1::DmUnsubscribe(target) => {
            state
                .message_realtime_hub
                .unsubscribe_dm(session_id, target)
                .await;
        }
    }

    let response = build_message_server_frame(frame);
    send_json_message(socket, &response).await.is_ok()
}

fn ws_upgrade_with_close(ws: WebSocketUpgrade, code: u16, reason: &'static str) -> Response {
    ws.on_upgrade(move |mut socket| async move {
        let _ = close_socket(&mut socket, code, reason).await;
    })
    .into_response()
}

/// 認証エラーをWS close codeへ写像したアップグレード応答を返す。
/// @param ws WSアップグレード
/// @param error 認証エラー
/// @returns アップグレード応答
/// @throws なし
fn ws_upgrade_with_auth_error(ws: WebSocketUpgrade, error: &auth::AuthError) -> Response {
    ws_upgrade_with_close(ws, error.ws_close_code(), error.app_code())
}

fn ws_handshake_error_response(
    status: StatusCode,
    code: &'static str,
    message: &'static str,
    request_id: String,
) -> Response {
    let body = WsHandshakeErrorBody {
        code,
        message,
        request_id,
    };
    (status, Json(body)).into_response()
}

/// WSへJSONメッセージを送信する。
/// @param socket WebSocket接続
/// @param payload 送信オブジェクト
/// @returns 送信成否
/// @throws なし
async fn send_json_message<T: Serialize>(socket: &mut WebSocket, payload: &T) -> Result<(), ()> {
    let text = serde_json::to_string(payload).map_err(|_| ())?;
    socket
        .send(Message::Text(text.into()))
        .await
        .map_err(|_| ())
}

/// 指定クローズコードでWSを切断する。
/// @param socket WebSocket接続
/// @param code クローズコード
/// @param reason 切断理由
/// @returns 送信成否
/// @throws なし
async fn close_socket(socket: &mut WebSocket, code: u16, reason: &str) -> Result<(), ()> {
    let frame = CloseFrame {
        code,
        reason: reason.to_owned().into(),
    };
    socket
        .send(Message::Close(Some(frame)))
        .await
        .map_err(|_| ())
}

/// WS接続後メッセージ操作の認可を検証する。
/// @param state アプリケーション状態
/// @param authenticated 認証済み主体
/// @param request_id 接続識別子
/// @param socket WebSocket接続
/// @returns 継続可否
/// @throws なし
async fn authorize_ws_stream_operation(
    state: &AppState,
    authenticated: &AuthenticatedPrincipal,
    request_id: &str,
    socket: &mut WebSocket,
) -> bool {
    match authorize_ws_stream_access(state, authenticated, request_id).await {
        Ok(()) => true,
        Err(error) => {
            let _ = close_socket(socket, error.ws_close_code(), error.app_code()).await;
            false
        }
    }
}

/// guild message frame の認可を検証する。
/// @param state アプリケーション状態
/// @param authenticated 認証済み主体
/// @param request_id 接続識別子
/// @param socket WebSocket接続
/// @param frame message frame
/// @returns 継続可否
/// @throws なし
async fn authorize_message_frame_operation(
    state: &AppState,
    authenticated: &AuthenticatedPrincipal,
    request_id: &str,
    socket: &mut WebSocket,
    frame: &ClientMessageFrameV1,
) -> bool {
    match authorize_message_frame_access(state, authenticated, request_id, frame).await {
        Ok(()) => true,
        Err(error) => {
            let _ = close_socket(socket, error.ws_close_code(), error.app_code()).await;
            false
        }
    }
}

/// WSストリーム操作の認可を評価する。
/// @param state アプリケーション状態
/// @param authenticated 認証済み主体
/// @param request_id 接続識別子
/// @returns 認可成功時は `Ok(())`
/// @throws authz::AuthzError 認可拒否または依存障害時
async fn authorize_ws_stream_access(
    state: &AppState,
    authenticated: &AuthenticatedPrincipal,
    request_id: &str,
) -> Result<(), authz::AuthzError> {
    check_ws_stream_access_for_principal(state, authenticated.principal_id, request_id).await
}

/// WSストリーム操作の生判定を評価する。
/// @param state アプリケーション状態
/// @param authenticated 認証済み主体
/// @param request_id 接続識別子
/// @returns 認可成功時は `Ok(())`
/// @throws authz::AuthzError 認可拒否または依存障害時
async fn check_ws_stream_access(
    state: &AppState,
    authenticated: &AuthenticatedPrincipal,
    request_id: &str,
) -> Result<(), authz::AuthzError> {
    check_ws_stream_access_for_principal(state, authenticated.principal_id, request_id).await
}

/// WSストリーム操作の生判定を主体IDで評価する。
/// @param state アプリケーション状態
/// @param principal_id 認可対象主体
/// @param request_id 接続識別子
/// @returns 認可成功時は `Ok(())`
/// @throws authz::AuthzError 認可拒否または依存障害時
async fn check_ws_stream_access_for_principal(
    state: &AppState,
    principal_id: PrincipalId,
    request_id: &str,
) -> Result<(), authz::AuthzError> {
    let authz_input = AuthzCheckInput {
        principal_id,
        resource: AuthzResource::RestPath {
            path: "/ws/stream".to_owned(),
        },
        action: AuthzAction::View,
    };
    if let Err(error) = state.authorizer.check(&authz_input).await {
        state.authz_metrics.record_error(&error);
        tracing::warn!(
            decision = %error.decision(),
            request_id = %request_id,
            principal_id = principal_id.0,
            error_class = %error.log_class(),
            reason = %error.reason,
            resource = "/ws/stream",
            action = "view",
            decision_source = "authorizer",
            "WS authz rejected at stream operation"
        );
        return Err(error);
    }
    state.authz_metrics.record_allow();
    Ok(())
}

/// guild message frame の認可を評価する。
/// @param state アプリケーション状態
/// @param authenticated 認証済み主体
/// @param request_id 接続識別子
/// @param frame message frame
/// @returns 認可成功時は `Ok(())`
/// @throws authz::AuthzError 認可拒否または依存障害時
async fn authorize_message_frame_access(
    state: &AppState,
    authenticated: &AuthenticatedPrincipal,
    request_id: &str,
    frame: &ClientMessageFrameV1,
) -> Result<(), authz::AuthzError> {
    check_ws_stream_access(state, authenticated, request_id).await?;
    check_message_frame_target_access(state, authenticated, request_id, frame).await
}

/// guild message frame target の生判定を評価する。
/// @param state アプリケーション状態
/// @param authenticated 認証済み主体
/// @param request_id 接続識別子
/// @param frame message frame
/// @returns 認可成功時は `Ok(())`
/// @throws authz::AuthzError 認可拒否または依存障害時
async fn check_message_frame_target_access(
    state: &AppState,
    authenticated: &AuthenticatedPrincipal,
    request_id: &str,
    frame: &ClientMessageFrameV1,
) -> Result<(), authz::AuthzError> {
    match frame {
        ClientMessageFrameV1::Subscribe(target) | ClientMessageFrameV1::Unsubscribe(target) => {
            check_message_target_access_for_principal(
                state,
                authenticated.principal_id,
                request_id,
                target,
            )
            .await
        }
        ClientMessageFrameV1::DmSubscribe(target)
        | ClientMessageFrameV1::DmUnsubscribe(target) => {
            check_dm_target_access_for_principal(
                state,
                authenticated.principal_id,
                request_id,
                target.channel_id,
            )
            .await
        }
    }
}

/// guild message target の生判定を主体IDで評価する。
/// @param state アプリケーション状態
/// @param principal_id 認可対象主体
/// @param request_id 接続識別子
/// @param target message frame target
/// @returns 認可成功時は `Ok(())`
/// @throws authz::AuthzError 認可拒否または依存障害時
async fn check_message_target_access_for_principal(
    state: &AppState,
    principal_id: PrincipalId,
    request_id: &str,
    target: &GuildChannelSubscriptionTargetV1,
) -> Result<(), authz::AuthzError> {
    let authz_input = AuthzCheckInput {
        principal_id,
        resource: AuthzResource::GuildChannel {
            guild_id: target.guild_id,
            channel_id: target.channel_id,
        },
        action: AuthzAction::View,
    };
    if let Err(error) = state.authorizer.check(&authz_input).await {
        state.authz_metrics.record_error(&error);
        tracing::warn!(
            decision = %error.decision(),
            request_id = %request_id,
            principal_id = principal_id.0,
            guild_id = target.guild_id,
            channel_id = target.channel_id,
            error_class = %error.log_class(),
            reason = %error.reason,
            resource = "guild_channel",
            action = "view",
            decision_source = "authorizer",
            "WS authz rejected at message frame operation"
        );
        return Err(error);
    }
    state.authz_metrics.record_allow();
    Ok(())
}

/// DM target の生判定を主体IDで評価する。
/// @param state アプリケーション状態
/// @param principal_id 認可対象主体
/// @param request_id 接続識別子
/// @param channel_id 購読対象 DM channel
/// @returns 認可成功時は `Ok(())`
/// @throws authz::AuthzError 認可拒否または依存障害時
async fn check_dm_target_access_for_principal(
    state: &AppState,
    principal_id: PrincipalId,
    request_id: &str,
    channel_id: i64,
) -> Result<(), authz::AuthzError> {
    let authz_input = AuthzCheckInput {
        principal_id,
        resource: AuthzResource::Channel { channel_id },
        action: AuthzAction::View,
    };
    if let Err(error) = state.authorizer.check(&authz_input).await {
        state.authz_metrics.record_error(&error);
        tracing::warn!(
            decision = %error.decision(),
            request_id = %request_id,
            principal_id = principal_id.0,
            channel_id,
            error_class = %error.log_class(),
            reason = %error.reason,
            resource = "channel",
            action = "view",
            decision_source = "authorizer",
            "WS authz rejected at DM frame operation"
        );
        return Err(error);
    }
    state.authz_metrics.record_allow();
    Ok(())
}
