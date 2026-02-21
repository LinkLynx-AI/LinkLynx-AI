use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MessagePayloadBase {
    pub message_id: String,
    pub channel_id: String,
    pub guild_id: Option<String>,
    pub author_id: String,
    pub content: String,
    pub sent_at: String,
    pub edited_at: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MessageCreatedPayload {
    pub message: MessagePayloadBase,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MessageUpdatedPayload {
    pub message: MessagePayloadBase,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MessageDeletedPayload {
    pub message_id: String,
    pub channel_id: String,
    pub guild_id: Option<String>,
    pub deleted_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(
    tag = "event_type",
    content = "payload",
    rename_all = "SCREAMING_SNAKE_CASE"
)]
pub enum ProtocolEventEnvelope {
    MessageCreated(MessageCreatedPayload),
    MessageUpdated(MessageUpdatedPayload),
    MessageDeleted(MessageDeletedPayload),
}

impl ProtocolEventEnvelope {
    pub fn event_type(&self) -> MessageEventType {
        match self {
            Self::MessageCreated(_) => MessageEventType::MessageCreated,
            Self::MessageUpdated(_) => MessageEventType::MessageUpdated,
            Self::MessageDeleted(_) => MessageEventType::MessageDeleted,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum MessageEventType {
    MessageCreated,
    MessageUpdated,
    MessageDeleted,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum MessagePayload {
    MessageCreated(MessageCreatedPayload),
    MessageUpdated(MessageUpdatedPayload),
    MessageDeleted(MessageDeletedPayload),
}

#[cfg(test)]
mod tests {
    use super::{
        MessageCreatedPayload, MessageDeletedPayload, MessagePayloadBase, MessageUpdatedPayload,
        ProtocolEventEnvelope,
    };
    use serde_json::json;

    fn build_message_payload() -> MessagePayloadBase {
        MessagePayloadBase {
            message_id: "msg_1".to_owned(),
            channel_id: "ch_1".to_owned(),
            guild_id: Some("guild_1".to_owned()),
            author_id: "user_1".to_owned(),
            content: "hello".to_owned(),
            sent_at: "2026-02-21T00:00:00Z".to_owned(),
            edited_at: None,
        }
    }

    #[test]
    fn envelope_variant_and_event_type_are_aligned() {
        let created = ProtocolEventEnvelope::MessageCreated(MessageCreatedPayload {
            message: build_message_payload(),
        });
        let updated = ProtocolEventEnvelope::MessageUpdated(MessageUpdatedPayload {
            message: build_message_payload(),
        });
        let deleted = ProtocolEventEnvelope::MessageDeleted(MessageDeletedPayload {
            message_id: "msg_1".to_owned(),
            channel_id: "ch_1".to_owned(),
            guild_id: Some("guild_1".to_owned()),
            deleted_at: "2026-02-21T01:00:00Z".to_owned(),
        });

        assert_eq!(
            serde_json::to_value(&created).unwrap()["event_type"],
            "MESSAGE_CREATED"
        );
        assert_eq!(
            serde_json::to_value(&updated).unwrap()["event_type"],
            "MESSAGE_UPDATED"
        );
        assert_eq!(
            serde_json::to_value(&deleted).unwrap()["event_type"],
            "MESSAGE_DELETED"
        );
    }

    #[test]
    fn deserialize_rejects_event_payload_mismatch() {
        let invalid = json!({
            "event_type": "MESSAGE_CREATED",
            "payload": {
                "message_id": "msg_1",
                "channel_id": "ch_1",
                "guild_id": "guild_1",
                "deleted_at": "2026-02-21T01:00:00Z"
            }
        });

        let parsed = serde_json::from_value::<ProtocolEventEnvelope>(invalid);
        assert!(parsed.is_err());
    }
}
