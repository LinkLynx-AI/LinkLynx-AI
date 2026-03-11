use linklynx_message_api::MessageItemV1;
use serde::{Deserialize, Serialize};

/// guild text channel の購読対象を表現する。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct GuildChannelSubscriptionTargetV1 {
    pub guild_id: i64,
    pub channel_id: i64,
}

/// DM の購読対象を表現する。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DmChannelSubscriptionTargetV1 {
    pub channel_id: i64,
}

/// client -> server の message WS frame を表現する。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", content = "d")]
pub enum ClientMessageFrameV1 {
    #[serde(rename = "message.subscribe")]
    Subscribe(GuildChannelSubscriptionTargetV1),
    #[serde(rename = "message.unsubscribe")]
    Unsubscribe(GuildChannelSubscriptionTargetV1),
    #[serde(rename = "dm.subscribe")]
    DmSubscribe(DmChannelSubscriptionTargetV1),
    #[serde(rename = "dm.unsubscribe")]
    DmUnsubscribe(DmChannelSubscriptionTargetV1),
}

/// server -> client の購読状態 payload を表現する。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MessageSubscriptionStateV1 {
    pub guild_id: i64,
    pub channel_id: i64,
}

/// server -> client の DM 購読状態 payload を表現する。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DmMessageSubscriptionStateV1 {
    pub channel_id: i64,
}

/// server -> client の message event payload を表現する。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MessageEventFrameDataV1 {
    pub guild_id: i64,
    pub channel_id: i64,
    pub message: MessageItemV1,
}

/// server -> client の DM message event payload を表現する。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DmMessageEventFrameDataV1 {
    pub channel_id: i64,
    pub message: MessageItemV1,
}

/// server -> client の message WS frame を表現する。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", content = "d")]
pub enum ServerMessageFrameV1 {
    #[serde(rename = "message.subscribed")]
    Subscribed(MessageSubscriptionStateV1),
    #[serde(rename = "message.unsubscribed")]
    Unsubscribed(MessageSubscriptionStateV1),
    #[serde(rename = "message.created")]
    Created(MessageEventFrameDataV1),
    #[serde(rename = "message.updated")]
    Updated(MessageEventFrameDataV1),
    #[serde(rename = "message.deleted")]
    Deleted(MessageEventFrameDataV1),
    #[serde(rename = "dm.subscribed")]
    DmSubscribed(DmMessageSubscriptionStateV1),
    #[serde(rename = "dm.unsubscribed")]
    DmUnsubscribed(DmMessageSubscriptionStateV1),
    #[serde(rename = "dm.message.created")]
    DmCreated(DmMessageEventFrameDataV1),
}

impl From<GuildChannelSubscriptionTargetV1> for MessageSubscriptionStateV1 {
    fn from(value: GuildChannelSubscriptionTargetV1) -> Self {
        Self {
            guild_id: value.guild_id,
            channel_id: value.channel_id,
        }
    }
}

impl From<DmChannelSubscriptionTargetV1> for DmMessageSubscriptionStateV1 {
    fn from(value: DmChannelSubscriptionTargetV1) -> Self {
        Self {
            channel_id: value.channel_id,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_message() -> MessageItemV1 {
        MessageItemV1 {
            message_id: 100,
            guild_id: 10,
            channel_id: 20,
            author_id: 30,
            content: "hello".to_owned(),
            created_at: "2026-03-07T10:00:00Z".to_owned(),
            version: 1,
            edited_at: None,
            is_deleted: false,
        }
    }

    #[test]
    fn client_subscribe_frame_uses_type_and_d_contract() {
        let frame = ClientMessageFrameV1::Subscribe(GuildChannelSubscriptionTargetV1 {
            guild_id: 10,
            channel_id: 20,
        });

        let value = serde_json::to_value(&frame).unwrap();
        assert_eq!(value["type"], "message.subscribe");
        assert_eq!(value["d"]["guild_id"], 10);
        assert_eq!(value["d"]["channel_id"], 20);
    }

    #[test]
    fn server_created_frame_deserializes_with_future_message_fields() {
        let payload = serde_json::json!({
            "type": "message.created",
            "d": {
                "guild_id": 10,
                "channel_id": 20,
                "message": {
                    "message_id": 100,
                    "guild_id": 10,
                    "channel_id": 20,
                    "author_id": 30,
                    "content": "hello",
                    "created_at": "2026-03-07T10:00:00Z",
                    "version": 1,
                    "edited_at": null,
                    "is_deleted": false,
                    "future_field": "ignored"
                }
            }
        });

        let parsed = serde_json::from_value::<ServerMessageFrameV1>(payload).unwrap();
        match parsed {
            ServerMessageFrameV1::Created(data) => assert_eq!(data.message.message_id, 100),
            _ => panic!("expected message.created frame"),
        }
    }

    #[test]
    fn server_unsubscribed_frame_serializes_with_subscription_state() {
        let frame = ServerMessageFrameV1::Unsubscribed(MessageSubscriptionStateV1 {
            guild_id: 10,
            channel_id: 20,
        });

        let value = serde_json::to_value(&frame).unwrap();
        assert_eq!(value["type"], "message.unsubscribed");
        assert_eq!(value["d"]["guild_id"], 10);
        assert_eq!(value["d"]["channel_id"], 20);
    }

    #[test]
    fn client_dm_subscribe_frame_uses_type_and_d_contract() {
        let frame =
            ClientMessageFrameV1::DmSubscribe(DmChannelSubscriptionTargetV1 { channel_id: 20 });

        let value = serde_json::to_value(&frame).unwrap();
        assert_eq!(value["type"], "dm.subscribe");
        assert_eq!(value["d"]["channel_id"], 20);
    }

    #[test]
    fn server_dm_created_frame_deserializes_with_future_message_fields() {
        let payload = serde_json::json!({
            "type": "dm.message.created",
            "d": {
                "channel_id": 20,
                "message": {
                    "message_id": 100,
                    "guild_id": 20,
                    "channel_id": 20,
                    "author_id": 30,
                    "content": "hello",
                    "created_at": "2026-03-07T10:00:00Z",
                    "version": 1,
                    "edited_at": null,
                    "is_deleted": false,
                    "future_field": "ignored"
                }
            }
        });

        let parsed = serde_json::from_value::<ServerMessageFrameV1>(payload).unwrap();
        match parsed {
            ServerMessageFrameV1::DmCreated(data) => assert_eq!(data.message.message_id, 100),
            _ => panic!("expected dm.message.created frame"),
        }
    }

    #[test]
    fn server_dm_unsubscribed_frame_serializes_with_subscription_state() {
        let frame =
            ServerMessageFrameV1::DmUnsubscribed(DmMessageSubscriptionStateV1 { channel_id: 20 });

        let value = serde_json::to_value(&frame).unwrap();
        assert_eq!(value["type"], "dm.unsubscribed");
        assert_eq!(value["d"]["channel_id"], 20);
    }

    #[test]
    fn created_frame_keeps_message_snapshot() {
        let frame = ServerMessageFrameV1::Created(MessageEventFrameDataV1 {
            guild_id: 10,
            channel_id: 20,
            message: sample_message(),
        });

        let value = serde_json::to_value(&frame).unwrap();
        assert_eq!(value["d"]["message"]["message_id"], 100);
        assert_eq!(value["d"]["message"]["content"], "hello");
    }

    #[test]
    fn updated_frame_keeps_message_snapshot() {
        let frame = ServerMessageFrameV1::Updated(MessageEventFrameDataV1 {
            guild_id: 10,
            channel_id: 20,
            message: sample_message(),
        });

        let value = serde_json::to_value(&frame).unwrap();
        assert_eq!(value["type"], "message.updated");
        assert_eq!(value["d"]["message"]["message_id"], 100);
    }

    #[test]
    fn deleted_frame_keeps_message_snapshot() {
        let mut message = sample_message();
        message.content.clear();
        message.version = 2;
        message.edited_at = Some("2026-03-07T10:05:00Z".to_owned());
        message.is_deleted = true;
        let frame = ServerMessageFrameV1::Deleted(MessageEventFrameDataV1 {
            guild_id: 10,
            channel_id: 20,
            message,
        });

        let value = serde_json::to_value(&frame).unwrap();
        assert_eq!(value["type"], "message.deleted");
        assert_eq!(value["d"]["message"]["is_deleted"], true);
        assert_eq!(value["d"]["message"]["content"], "");
    }

    #[test]
    fn dm_created_frame_keeps_message_snapshot() {
        let frame = ServerMessageFrameV1::DmCreated(DmMessageEventFrameDataV1 {
            channel_id: 20,
            message: sample_message(),
        });

        let value = serde_json::to_value(&frame).unwrap();
        assert_eq!(value["type"], "dm.message.created");
        assert_eq!(value["d"]["channel_id"], 20);
        assert_eq!(value["d"]["message"]["message_id"], 100);
    }
}
