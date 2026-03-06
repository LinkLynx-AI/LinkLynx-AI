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
            reason = "ws_origin_not_allowed",
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

    let identify_rate_key = identify_rate_key(origin_header);
    let auth_header_present = headers.contains_key(axum::http::header::AUTHORIZATION);

    let header_token = if auth_header_present {
        match bearer_token_from_headers(&headers) {
            Ok(token) => Some(token),
            Err(error) => {
                tracing::warn!(
                    decision = %error.decision(),
                    request_id = %request_id,
                    error_class = %error.log_class(),
                    reason = %error.reason,
                    "WS auth rejected at header parsing"
                );
                return auth_error_response(&error, request_id);
            }
        }
    } else {
        None
    };

    let query_ticket_raw = query.ticket.as_deref();
    let query_ticket = query_ticket_raw
        .map(str::trim)
        .filter(|value| !value.is_empty());

    if query_ticket_raw.is_some() && query_ticket.is_none() && header_token.is_none() {
        return ws_upgrade_with_close(ws, 1008, "identify_invalid_ticket");
    }

    if let Some(token) = header_token {
        let authenticated = match state.auth_service.authenticate_token(&token).await {
            Ok(authenticated) => authenticated,
            Err(error) => {
                tracing::warn!(
                    decision = %error.decision(),
                    request_id = %request_id,
                    error_class = %error.log_class(),
                    reason = %error.reason,
                    "WS auth rejected at handshake"
                );
                return auth_error_response(&error, request_id);
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
                )
            })
            .into_response();
    }

    ws.on_upgrade(move |socket| handle_socket(socket, state, None, request_id, identify_rate_key))
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
) {
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
                        identify_deadline = None;
                    }
                }
                _ = tokio::time::sleep(timeout) => {
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
                        &state,
                        &mut socket,
                        authenticated_ref,
                        &request_id,
                        &mut reauth_deadline,
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
                    &state,
                    &mut socket,
                    authenticated_ref,
                    &request_id,
                    &mut reauth_deadline,
                    message,
                ).await;

                if !should_continue {
                    break;
                }
            }
            _ = tokio::time::sleep(wait_until_expired) => {}
        }
    }
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
        Message::Binary(_) => {
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
    state: &AppState,
    socket: &mut WebSocket,
    authenticated: &mut AuthenticatedPrincipal,
    request_id: &str,
    reauth_deadline: &mut Option<Instant>,
    message: Message,
) -> bool {
    match message {
        Message::Text(text) => {
            let text = text.to_string();

            match parse_client_ws_message(&text) {
                Some(ClientWsMessage::Identify { .. }) => {
                    let _ = close_socket(socket, 1008, "unexpected_identify").await;
                    return false;
                }
                Some(ClientWsMessage::Reauthenticate { .. }) => {}
                None => {
                    if reauth_deadline.is_some() {
                        state.auth_service.metrics().record_ws_reauth(false);
                        let _ = close_socket(socket, 1008, "reauth_required").await;
                        return false;
                    }
                    if !authorize_ws_stream_operation(state, authenticated, request_id, socket).await
                    {
                        return false;
                    }
                    return socket.send(Message::Text(text.into())).await.is_ok();
                }
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

fn identify_rate_key(origin_header: Option<&str>) -> String {
    let key = origin_header
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| "origin_missing".to_owned());
    format!("identify:{key}")
}

fn ws_upgrade_with_close(ws: WebSocketUpgrade, code: u16, reason: &'static str) -> Response {
    ws.on_upgrade(move |mut socket| async move {
        let _ = close_socket(&mut socket, code, reason).await;
    })
    .into_response()
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
    let authz_input = AuthzCheckInput {
        principal_id: authenticated.principal_id,
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
            principal_id = authenticated.principal_id.0,
            error_class = %error.log_class(),
            reason = %error.reason,
            resource = "/ws/stream",
            action = "view",
            decision_source = "authorizer",
            "WS authz rejected at stream operation"
        );
        let _ = close_socket(socket, error.ws_close_code(), error.app_code()).await;
        return false;
    }
    state.authz_metrics.record_allow();
    true
}
