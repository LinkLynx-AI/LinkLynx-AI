use std::collections::HashMap;

use linklynx_message_api::MessageItemV1;
use linklynx_shared::PrincipalId;
use tokio::sync::{mpsc, Mutex};

const MESSAGE_REALTIME_OUTBOUND_CAPACITY: usize = 64;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
struct MessageSubscriptionKey {
    guild_id: i64,
    channel_id: i64,
}

impl From<&GuildChannelSubscriptionTargetV1> for MessageSubscriptionKey {
    fn from(value: &GuildChannelSubscriptionTargetV1) -> Self {
        Self {
            guild_id: value.guild_id,
            channel_id: value.channel_id,
        }
    }
}

impl From<&MessageItemV1> for MessageSubscriptionKey {
    fn from(value: &MessageItemV1) -> Self {
        Self {
            guild_id: value.guild_id,
            channel_id: value.channel_id,
        }
    }
}

#[derive(Debug, Clone)]
struct MessageRealtimeSubscriber {
    principal_id: PrincipalId,
    sender: mpsc::Sender<ServerMessageFrameV1>,
}

#[derive(Default)]
struct MessageRealtimeHubState {
    channel_subscribers:
        HashMap<MessageSubscriptionKey, HashMap<String, MessageRealtimeSubscriber>>,
    session_subscriptions: HashMap<String, HashSet<MessageSubscriptionKey>>,
}

#[derive(Default)]
pub(crate) struct MessageRealtimeHub {
    state: Mutex<MessageRealtimeHubState>,
}

impl MessageRealtimeHub {
    /// セッションを channel 購読へ登録する。
    /// @param session_id WS セッション識別子
    /// @param principal_id 購読主体
    /// @param target 購読対象 channel
    /// @param sender セッション outbound sender
    /// @returns なし
    /// @throws なし
    async fn subscribe(
        &self,
        session_id: &str,
        principal_id: PrincipalId,
        target: &GuildChannelSubscriptionTargetV1,
        sender: mpsc::Sender<ServerMessageFrameV1>,
    ) {
        let mut state = self.state.lock().await;
        let key = MessageSubscriptionKey::from(target);
        state.channel_subscribers.entry(key).or_default().insert(
            session_id.to_owned(),
            MessageRealtimeSubscriber {
                principal_id,
                sender,
            },
        );
        state
            .session_subscriptions
            .entry(session_id.to_owned())
            .or_default()
            .insert(key);
    }

    /// セッションの channel 購読を解除する。
    /// @param session_id WS セッション識別子
    /// @param target 購読解除対象 channel
    /// @returns なし
    /// @throws なし
    async fn unsubscribe(&self, session_id: &str, target: &GuildChannelSubscriptionTargetV1) {
        let mut state = self.state.lock().await;
        let key = MessageSubscriptionKey::from(target);
        remove_subscription(&mut state, session_id, key);
    }

    /// セッションに紐づく全購読を cleanup する。
    /// @param session_id WS セッション識別子
    /// @returns なし
    /// @throws なし
    async fn disconnect_session(&self, session_id: &str) {
        let mut state = self.state.lock().await;
        remove_session(&mut state, session_id);
    }

    /// 再認証後に既存購読を再評価し、失効した購読を除去する。
    /// @param app_state アプリケーション状態
    /// @param session_id WS セッション識別子
    /// @param principal_id 再認証済み主体
    /// @returns なし
    /// @throws なし
    async fn reconcile_session_subscriptions(
        &self,
        app_state: &AppState,
        session_id: &str,
        principal_id: PrincipalId,
    ) {
        let subscribed_keys = {
            let state = self.state.lock().await;
            state
                .session_subscriptions
                .get(session_id)
                .cloned()
                .unwrap_or_default()
        };

        let mut invalid_keys = Vec::new();
        for key in subscribed_keys {
            if !subscription_access_allowed(app_state, principal_id, session_id, key).await {
                invalid_keys.push(key);
            }
        }

        if invalid_keys.is_empty() {
            return;
        }

        let mut state = self.state.lock().await;
        for key in invalid_keys {
            remove_subscription(&mut state, session_id, key);
        }
    }

    /// guild channel 購読中セッションへ message.created を best-effort 送信する。
    /// @param app_state アプリケーション状態
    /// @param message fanout 対象 message snapshot
    /// @returns なし
    /// @throws なし
    async fn publish_message_created(&self, app_state: &AppState, message: MessageItemV1) {
        let key = MessageSubscriptionKey::from(&message);
        let subscribers = {
            let state = self.state.lock().await;
            state
                .channel_subscribers
                .get(&key)
                .map(|subscribers| {
                    subscribers
                        .iter()
                        .map(|(session_id, subscriber)| {
                            (
                                session_id.clone(),
                                subscriber.principal_id,
                                subscriber.sender.clone(),
                            )
                        })
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default()
        };
        if subscribers.is_empty() {
            return;
        }

        let frame =
            ServerMessageFrameV1::Created(linklynx_protocol_ws::MessageCreatedFrameDataV1 {
                guild_id: message.guild_id,
                channel_id: message.channel_id,
                message,
            });
        let mut invalid_sessions = Vec::new();
        for (session_id, principal_id, sender) in subscribers {
            if !subscription_access_allowed(app_state, principal_id, &session_id, key).await {
                invalid_sessions.push(session_id);
                continue;
            }

            match sender.try_send(frame.clone()) {
                Ok(()) => {}
                Err(tokio::sync::mpsc::error::TrySendError::Full(_)) => {
                    tracing::warn!(
                        session_id = %session_id,
                        guild_id = key.guild_id,
                        channel_id = key.channel_id,
                        "dropping realtime frame because outbound queue is full"
                    );
                }
                Err(tokio::sync::mpsc::error::TrySendError::Closed(_)) => {
                    invalid_sessions.push(session_id);
                }
            }
        }

        if invalid_sessions.is_empty() {
            return;
        }

        let mut state = self.state.lock().await;
        for session_id in invalid_sessions {
            remove_subscription(&mut state, &session_id, key);
        }
    }
}

async fn subscription_access_allowed(
    app_state: &AppState,
    principal_id: PrincipalId,
    request_id: &str,
    key: MessageSubscriptionKey,
) -> bool {
    if check_ws_stream_access_for_principal(app_state, principal_id, request_id)
        .await
        .is_err()
    {
        return false;
    }

    let target = GuildChannelSubscriptionTargetV1 {
        guild_id: key.guild_id,
        channel_id: key.channel_id,
    };
    check_message_target_access_for_principal(app_state, principal_id, request_id, &target)
        .await
        .is_ok()
}

fn remove_subscription(
    state: &mut MessageRealtimeHubState,
    session_id: &str,
    key: MessageSubscriptionKey,
) {
    if let Some(subscribers) = state.channel_subscribers.get_mut(&key) {
        subscribers.remove(session_id);
        if subscribers.is_empty() {
            state.channel_subscribers.remove(&key);
        }
    }

    if let Some(keys) = state.session_subscriptions.get_mut(session_id) {
        keys.remove(&key);
        if keys.is_empty() {
            state.session_subscriptions.remove(session_id);
        }
    }
}

fn remove_session(state: &mut MessageRealtimeHubState, session_id: &str) {
    let Some(keys) = state.session_subscriptions.remove(session_id) else {
        return;
    };

    for key in keys {
        if let Some(subscribers) = state.channel_subscribers.get_mut(&key) {
            subscribers.remove(session_id);
            if subscribers.is_empty() {
                state.channel_subscribers.remove(&key);
            }
        }
    }
}

#[cfg(test)]
mod realtime_tests {
    use super::*;

    fn sample_target() -> GuildChannelSubscriptionTargetV1 {
        GuildChannelSubscriptionTargetV1 {
            guild_id: 10,
            channel_id: 20,
        }
    }

    fn sample_message() -> MessageItemV1 {
        MessageItemV1 {
            message_id: 100,
            guild_id: 10,
            channel_id: 20,
            author_id: 30,
            content: "hello realtime".to_owned(),
            created_at: "2026-03-10T10:00:00Z".to_owned(),
            version: 1,
            edited_at: None,
            is_deleted: false,
        }
    }

    #[tokio::test]
    async fn subscribe_stores_principal_and_delivery_metadata() {
        let hub = MessageRealtimeHub::default();
        let (sender, _receiver) = mpsc::channel(MESSAGE_REALTIME_OUTBOUND_CAPACITY);

        hub.subscribe("session-1", PrincipalId(30), &sample_target(), sender)
            .await;

        let state = hub.state.lock().await;
        let subscriber = state
            .channel_subscribers
            .get(&MessageSubscriptionKey {
                guild_id: 10,
                channel_id: 20,
            })
            .and_then(|subscribers| subscribers.get("session-1"))
            .expect("subscriber should exist");
        assert_eq!(subscriber.principal_id, PrincipalId(30));
    }

    #[tokio::test]
    async fn unsubscribe_stops_future_delivery() {
        let hub = MessageRealtimeHub::default();
        let (sender, mut receiver) = mpsc::channel(MESSAGE_REALTIME_OUTBOUND_CAPACITY);

        hub.subscribe("session-1", PrincipalId(30), &sample_target(), sender)
            .await;
        hub.unsubscribe("session-1", &sample_target()).await;

        let state = hub.state.lock().await;
        assert!(state.channel_subscribers.is_empty());
        assert!(state.session_subscriptions.is_empty());
        drop(state);

        assert!(receiver.try_recv().is_err());
    }

    #[tokio::test]
    async fn disconnect_session_cleans_all_subscriptions() {
        let hub = MessageRealtimeHub::default();
        let (sender, mut receiver) = mpsc::channel(MESSAGE_REALTIME_OUTBOUND_CAPACITY);

        hub.subscribe("session-1", PrincipalId(30), &sample_target(), sender)
            .await;
        hub.disconnect_session("session-1").await;

        assert!(receiver.try_recv().is_err());
        let state = hub.state.lock().await;
        assert!(state.channel_subscribers.is_empty());
        assert!(state.session_subscriptions.is_empty());
    }

    #[tokio::test]
    async fn full_queue_drops_frame_without_removing_subscription() {
        let hub = MessageRealtimeHub::default();
        let (sender, mut receiver) = mpsc::channel(1);
        let key = MessageSubscriptionKey {
            guild_id: 10,
            channel_id: 20,
        };
        let frame =
            ServerMessageFrameV1::Created(linklynx_protocol_ws::MessageCreatedFrameDataV1 {
                guild_id: 10,
                channel_id: 20,
                message: sample_message(),
            });

        hub.subscribe("session-1", PrincipalId(30), &sample_target(), sender)
            .await;
        {
            let state = hub.state.lock().await;
            state
                .channel_subscribers
                .get(&key)
                .and_then(|subscribers| subscribers.get("session-1"))
                .expect("subscriber should exist")
                .sender
                .try_send(frame.clone())
                .expect("first frame should fit");
        }
        {
            let state = hub.state.lock().await;
            assert!(matches!(
                state
                    .channel_subscribers
                    .get(&key)
                    .and_then(|subscribers| subscribers.get("session-1"))
                    .expect("subscriber should exist")
                    .sender
                    .try_send(frame),
                Err(tokio::sync::mpsc::error::TrySendError::Full(_))
            ));
        }

        let first = receiver.try_recv().expect("first frame should arrive");
        assert!(matches!(first, ServerMessageFrameV1::Created(_)));

        let state = hub.state.lock().await;
        assert!(state.session_subscriptions.contains_key("session-1"));
        assert!(state.channel_subscribers.contains_key(&key));
    }
}
