/// WS接続ハンドシェイクを処理する。
/// @param state アプリケーション状態
/// @param headers HTTPヘッダー
/// @param ws WSアップグレード
/// @returns ハンドシェイク応答
/// @throws なし
async fn ws_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    ws: WebSocketUpgrade,
) -> Response {
    let request_id = request_id_from_headers(&headers);
    let token = match bearer_token_from_headers(&headers) {
        Ok(token) => token,
        Err(error) => {
            tracing::warn!(
                decision = %error.decision(),
                email_verification = %error.email_verification_result(),
                request_id = %request_id,
                error_class = %error.log_class(),
                reason = %error.reason,
                "WS auth rejected at header parsing"
            );
            return auth_error_response(&error, request_id);
        }
    };

    let authenticated = match state.auth_service.authenticate_token(&token).await {
        Ok(authenticated) => authenticated,
        Err(error) => {
            tracing::warn!(
                decision = %error.decision(),
                email_verification = %error.email_verification_result(),
                request_id = %request_id,
                error_class = %error.log_class(),
                reason = %error.reason,
                "WS auth rejected at handshake"
            );
            return auth_error_response(&error, request_id);
        }
    };

    tracing::info!(
        decision = "allow",
        email_verification = "passed",
        request_id = %request_id,
        principal_id = authenticated.principal_id.0,
        firebase_uid = %authenticated.firebase_uid,
        "WS auth accepted at handshake"
    );

    ws.on_upgrade(move |socket| handle_socket(socket, state, authenticated, request_id))
        .into_response()
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
enum ClientWsMessage {
    #[serde(rename = "auth.reauthenticate")]
    Reauthenticate { token: String },
}

/// テキストメッセージから再認証トークンを抽出する。
/// @param text クライアント送信テキスト
/// @returns 再認証トークン（存在時）
/// @throws なし
fn parse_reauth_token(text: &str) -> Option<String> {
    match serde_json::from_str::<ClientWsMessage>(text) {
        Ok(ClientWsMessage::Reauthenticate { token }) => Some(token),
        Err(_) => None,
    }
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

/// WSセッションを処理する。
/// @param socket WebSocket接続
/// @param state アプリケーション状態
/// @param authenticated 認証済み主体
/// @param request_id 接続識別子
/// @returns なし
/// @throws なし
async fn handle_socket(
    mut socket: WebSocket,
    state: AppState,
    mut authenticated: AuthenticatedPrincipal,
    request_id: String,
) {
    let mut reauth_deadline: Option<Instant> = None;

    loop {
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

                    let should_continue = handle_socket_message(
                        &state,
                        &mut socket,
                        &mut authenticated,
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
        if now >= authenticated.expires_at_epoch {
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

        let wait_until_expired = Duration::from_secs(authenticated.expires_at_epoch - now);
        tokio::select! {
            incoming = socket.recv() => {
                let Some(incoming) = incoming else {
                    break;
                };

                let Ok(message) = incoming else {
                    break;
                };

                let should_continue = handle_socket_message(
                    &state,
                    &mut socket,
                    &mut authenticated,
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

/// WS受信メッセージを処理する。
/// @param state アプリケーション状態
/// @param socket WebSocket接続
/// @param authenticated 認証済み主体
/// @param request_id 接続識別子
/// @param reauth_deadline 再認証期限
/// @param message 受信メッセージ
/// @returns 継続可否
/// @throws なし
async fn handle_socket_message(
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

            if let Some(token) = parse_reauth_token(&text) {
                match state.auth_service.authenticate_token(&token).await {
                    Ok(next_principal) => {
                        if next_principal.principal_id != authenticated.principal_id {
                            state.auth_service.metrics().record_ws_reauth(false);
                            tracing::warn!(
                                decision = "deny",
                                email_verification = "passed",
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
                            email_verification = "passed",
                            request_id = %request_id,
                            principal_id = authenticated.principal_id.0,
                            firebase_uid = %authenticated.firebase_uid,
                            "WS reauth accepted"
                        );

                        let ack = WsReauthenticateAck {
                            message_type: "auth.reauthenticated",
                            principal_id: authenticated.principal_id.0,
                            request_id,
                        };

                        return send_json_message(socket, &ack).await.is_ok();
                    }
                    Err(error) => {
                        state.auth_service.metrics().record_ws_reauth(false);
                        tracing::warn!(
                            decision = %error.decision(),
                            email_verification = %error.email_verification_result(),
                            request_id = %request_id,
                            error_class = %error.log_class(),
                            reason = %error.reason,
                            "WS reauth rejected"
                        );
                        let _ = close_socket(socket, error.ws_close_code(), error.app_code()).await;
                        return false;
                    }
                }
            }

            if reauth_deadline.is_some() {
                state.auth_service.metrics().record_ws_reauth(false);
                let _ = close_socket(socket, 1008, "reauth_required").await;
                return false;
            }

            socket.send(Message::Text(text.into())).await.is_ok()
        }
        Message::Binary(_) => {
            if reauth_deadline.is_some() {
                state.auth_service.metrics().record_ws_reauth(false);
                let _ = close_socket(socket, 1008, "reauth_required").await;
                return false;
            }
            true
        }
        Message::Ping(payload) => socket.send(Message::Pong(payload)).await.is_ok(),
        Message::Pong(_) => true,
        Message::Close(_) => false,
    }
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
