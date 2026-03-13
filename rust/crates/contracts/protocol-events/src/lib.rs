use linklynx_message_api::MessageItemV1;
use serde::{Deserialize, Serialize};

pub const MESSAGE_CREATE_EVENT_NAME_V1: &str = "message_create";
pub const MESSAGE_CREATE_EVENT_TYPE_V1: &str = "MessageCreated";

/// durable message create event を表現する。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MessageCreateEventV1 {
    pub event_id: String,
    #[serde(rename = "type")]
    pub event_type: String,
    pub occurred_at: String,
    pub ordering_key: String,
    pub message: MessageItemV1,
}

impl MessageCreateEventV1 {
    /// MessageCreated event を構築する。
    /// @param event_id イベント識別子
    /// @param occurred_at 発生時刻
    /// @param message 送信時点のメッセージスナップショット
    /// @returns MessageCreateEventV1
    /// @throws なし
    pub fn new(
        event_id: impl Into<String>,
        occurred_at: impl Into<String>,
        message: MessageItemV1,
    ) -> Self {
        Self {
            event_id: event_id.into(),
            event_type: MESSAGE_CREATE_EVENT_TYPE_V1.to_owned(),
            occurred_at: occurred_at.into(),
            ordering_key: message_create_ordering_key(message.channel_id),
            message,
        }
    }

    /// canonical event catalog 名を返す。
    /// @param なし
    /// @returns `message_create`
    /// @throws なし
    pub fn catalog_name() -> &'static str {
        MESSAGE_CREATE_EVENT_NAME_V1
    }
}

/// message create event の ordering key を返す。
/// @param channel_id 対象 channel_id
/// @returns `channel:{channel_id}` 形式の ordering key
/// @throws なし
pub fn message_create_ordering_key(channel_id: i64) -> String {
    format!("channel:{channel_id}")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_message() -> MessageItemV1 {
        MessageItemV1 {
            message_id: 200,
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
    fn new_event_uses_transport_type_and_catalog_name() {
        let event = MessageCreateEventV1::new("evt-1", "2026-03-07T10:00:01Z", sample_message());

        assert_eq!(event.event_type, MESSAGE_CREATE_EVENT_TYPE_V1);
        assert_eq!(
            MessageCreateEventV1::catalog_name(),
            MESSAGE_CREATE_EVENT_NAME_V1
        );
        assert_eq!(event.ordering_key, "channel:20");
    }

    #[test]
    fn event_snapshot_matches_contract_fixture() {
        let event = MessageCreateEventV1::new("evt-1", "2026-03-07T10:00:01Z", sample_message());
        let serialized = serde_json::to_string_pretty(&event).unwrap();

        assert_eq!(
            serialized,
            include_str!("../snapshots/message_create_event_v1.json").trim_end()
        );
    }

    #[test]
    fn event_serialization_keeps_message_snapshot() {
        let event = MessageCreateEventV1::new("evt-1", "2026-03-07T10:00:01Z", sample_message());

        let value = serde_json::to_value(&event).unwrap();
        assert_eq!(value["type"], "MessageCreated");
        assert_eq!(value["message"]["message_id"], 200);
        assert_eq!(value["ordering_key"], "channel:20");
    }

    #[test]
    fn event_deserialization_ignores_future_message_fields() {
        let payload = serde_json::json!({
            "event_id": "evt-1",
            "type": "MessageCreated",
            "occurred_at": "2026-03-07T10:00:01Z",
            "ordering_key": "channel:20",
            "message": {
                "message_id": 200,
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
        });

        let parsed = serde_json::from_value::<MessageCreateEventV1>(payload).unwrap();
        assert_eq!(parsed.message.message_id, 200);
    }
}
