use chrono::{DateTime, Utc};
use serde::{de::DeserializeOwned, Serialize};
use uuid::Uuid;

fn assert_snapshot_roundtrip<T>(value: &T, snapshot: &str)
where
    T: Serialize + DeserializeOwned + PartialEq + std::fmt::Debug,
{
    let serialized = serde_json::to_string(value).expect("serialize contract value");
    assert_eq!(serialized, snapshot);

    let deserialized: T = serde_json::from_str(snapshot).expect("deserialize snapshot");
    assert_eq!(deserialized, *value);
}

fn fixed_uuid(raw: &str) -> Uuid {
    Uuid::parse_str(raw).expect("valid fixed uuid")
}

fn fixed_time(raw: &str) -> DateTime<Utc> {
    DateTime::parse_from_rfc3339(raw)
        .expect("valid rfc3339 timestamp")
        .with_timezone(&Utc)
}

mod protocol_ws_contracts {
    use super::assert_snapshot_roundtrip;
    use crate::contracts::protocol_ws::{
        AckPayload, AckStatus, AuthPayload, EventPayload, Frame, HelloPayload, Op,
        SendMessagePayload,
    };

    #[test]
    fn op_snapshot_is_stable() {
        assert_snapshot_roundtrip(&Op::SendMessage, r#""SEND_MESSAGE""#);
    }

    #[test]
    fn ack_status_snapshot_is_stable() {
        assert_snapshot_roundtrip(&AckStatus::Persisted, r#""persisted""#);
    }

    #[test]
    fn hello_frame_snapshot_is_stable() {
        let frame = Frame::Hello(HelloPayload {
            connection_id: "conn-fixed".to_owned(),
            heartbeat_interval_ms: 30_000,
        });

        assert_snapshot_roundtrip(
            &frame,
            r#"{"op":"HELLO","d":{"connection_id":"conn-fixed","heartbeat_interval_ms":30000}}"#,
        );
    }

    #[test]
    fn auth_frame_snapshot_is_stable() {
        let frame = Frame::Auth(AuthPayload {
            token: "token-fixed".to_owned(),
        });

        assert_snapshot_roundtrip(&frame, r#"{"op":"AUTH","d":{"token":"token-fixed"}}"#);
    }

    #[test]
    fn send_message_frame_snapshot_is_stable() {
        let frame = Frame::SendMessage(SendMessagePayload {
            correlation_id: "corr-fixed".to_owned(),
            channel_id: "channel-fixed".to_owned(),
            content: "hello snapshot".to_owned(),
        });

        assert_snapshot_roundtrip(
            &frame,
            r#"{"op":"SEND_MESSAGE","d":{"correlation_id":"corr-fixed","channel_id":"channel-fixed","content":"hello snapshot"}}"#,
        );
    }

    #[test]
    fn ack_frame_snapshot_is_stable() {
        let frame = Frame::Ack(AckPayload {
            correlation_id: "corr-fixed".to_owned(),
            status: AckStatus::Failed,
            code: Some("RATE_LIMITED".to_owned()),
            reason: Some("too many requests".to_owned()),
        });

        assert_snapshot_roundtrip(
            &frame,
            r#"{"op":"ACK","d":{"correlation_id":"corr-fixed","status":"failed","code":"RATE_LIMITED","reason":"too many requests"}}"#,
        );
    }

    #[test]
    fn event_frame_snapshot_is_stable() {
        let frame = Frame::Event(EventPayload {
            event_type: "MESSAGE_CREATED".to_owned(),
            event: serde_json::json!({
                "message_id": "msg-fixed",
            }),
        });

        assert_snapshot_roundtrip(
            &frame,
            r#"{"op":"EVENT","d":{"event_type":"MESSAGE_CREATED","event":{"message_id":"msg-fixed"}}}"#,
        );
    }
}

mod protocol_event_contracts {
    use super::assert_snapshot_roundtrip;
    use crate::contracts::protocol_events::{
        MessageCreatedPayload, MessageDeletedPayload, MessageEventType, MessagePayload,
        MessagePayloadBase, MessageUpdatedPayload, ProtocolEventEnvelope,
    };

    fn sample_message_payload() -> MessagePayloadBase {
        MessagePayloadBase {
            message_id: "msg-fixed".to_owned(),
            channel_id: "channel-fixed".to_owned(),
            guild_id: Some("guild-fixed".to_owned()),
            author_id: "user-fixed".to_owned(),
            content: "hello snapshot".to_owned(),
            sent_at: "2026-02-21T00:00:00Z".to_owned(),
            edited_at: Some("2026-02-21T00:01:00Z".to_owned()),
        }
    }

    #[test]
    fn message_event_type_snapshot_is_stable() {
        assert_snapshot_roundtrip(&MessageEventType::MessageUpdated, r#""MESSAGE_UPDATED""#);
    }

    #[test]
    fn message_payload_snapshot_is_stable() {
        let payload = MessagePayload::MessageDeleted(MessageDeletedPayload {
            message_id: "msg-fixed".to_owned(),
            channel_id: "channel-fixed".to_owned(),
            guild_id: Some("guild-fixed".to_owned()),
            deleted_at: "2026-02-21T01:00:00Z".to_owned(),
        });

        assert_snapshot_roundtrip(
            &payload,
            r#"{"MESSAGE_DELETED":{"message_id":"msg-fixed","channel_id":"channel-fixed","guild_id":"guild-fixed","deleted_at":"2026-02-21T01:00:00Z"}}"#,
        );
    }

    #[test]
    fn message_created_event_snapshot_is_stable() {
        let envelope = ProtocolEventEnvelope::MessageCreated(MessageCreatedPayload {
            message: sample_message_payload(),
        });

        assert_snapshot_roundtrip(
            &envelope,
            r#"{"event_type":"MESSAGE_CREATED","payload":{"message":{"message_id":"msg-fixed","channel_id":"channel-fixed","guild_id":"guild-fixed","author_id":"user-fixed","content":"hello snapshot","sent_at":"2026-02-21T00:00:00Z","edited_at":"2026-02-21T00:01:00Z"}}}"#,
        );
    }

    #[test]
    fn message_updated_event_snapshot_is_stable() {
        let envelope = ProtocolEventEnvelope::MessageUpdated(MessageUpdatedPayload {
            message: sample_message_payload(),
        });

        assert_snapshot_roundtrip(
            &envelope,
            r#"{"event_type":"MESSAGE_UPDATED","payload":{"message":{"message_id":"msg-fixed","channel_id":"channel-fixed","guild_id":"guild-fixed","author_id":"user-fixed","content":"hello snapshot","sent_at":"2026-02-21T00:00:00Z","edited_at":"2026-02-21T00:01:00Z"}}}"#,
        );
    }

    #[test]
    fn message_deleted_event_snapshot_is_stable() {
        let envelope = ProtocolEventEnvelope::MessageDeleted(MessageDeletedPayload {
            message_id: "msg-fixed".to_owned(),
            channel_id: "channel-fixed".to_owned(),
            guild_id: Some("guild-fixed".to_owned()),
            deleted_at: "2026-02-21T01:00:00Z".to_owned(),
        });

        assert_snapshot_roundtrip(
            &envelope,
            r#"{"event_type":"MESSAGE_DELETED","payload":{"message_id":"msg-fixed","channel_id":"channel-fixed","guild_id":"guild-fixed","deleted_at":"2026-02-21T01:00:00Z"}}"#,
        );
    }
}

mod message_api_contracts {
    use super::{assert_snapshot_roundtrip, fixed_time, fixed_uuid};
    use crate::contracts::message_api::{command, query};

    fn sample_request() -> command::SendMessageRequest {
        command::SendMessageRequest {
            conversation_id: fixed_uuid("11111111-1111-1111-1111-111111111111"),
            sender_id: fixed_uuid("22222222-2222-2222-2222-222222222222"),
            body: "hello snapshot".to_owned(),
        }
    }

    #[test]
    fn send_message_request_snapshot_is_stable() {
        let request = sample_request();
        assert_snapshot_roundtrip(
            &request,
            r#"{"conversation_id":"11111111-1111-1111-1111-111111111111","sender_id":"22222222-2222-2222-2222-222222222222","body":"hello snapshot"}"#,
        );
    }

    #[test]
    fn send_message_response_snapshot_is_stable() {
        let response = command::SendMessageResponse {
            message_id: fixed_uuid("33333333-3333-3333-3333-333333333333"),
            conversation_id: fixed_uuid("11111111-1111-1111-1111-111111111111"),
            sender_id: fixed_uuid("22222222-2222-2222-2222-222222222222"),
            body: "hello snapshot".to_owned(),
            sent_at: fixed_time("2026-02-20T05:25:34Z"),
        };

        assert_snapshot_roundtrip(
            &response,
            r#"{"message_id":"33333333-3333-3333-3333-333333333333","conversation_id":"11111111-1111-1111-1111-111111111111","sender_id":"22222222-2222-2222-2222-222222222222","body":"hello snapshot","sent_at":"2026-02-20T05:25:34Z"}"#,
        );
    }

    #[test]
    fn list_messages_request_snapshot_is_stable() {
        let request = query::ListMessagesRequest {
            conversation_id: fixed_uuid("11111111-1111-1111-1111-111111111111"),
            cursor: Some("cursor-fixed".to_owned()),
            limit: Some(50),
        };

        assert_snapshot_roundtrip(
            &request,
            r#"{"conversation_id":"11111111-1111-1111-1111-111111111111","cursor":"cursor-fixed","limit":50}"#,
        );
    }

    #[test]
    fn list_messages_request_without_optional_fields_snapshot_is_stable() {
        let request = query::ListMessagesRequest {
            conversation_id: fixed_uuid("11111111-1111-1111-1111-111111111111"),
            cursor: None,
            limit: None,
        };

        assert_snapshot_roundtrip(
            &request,
            r#"{"conversation_id":"11111111-1111-1111-1111-111111111111"}"#,
        );
    }

    #[test]
    fn list_messages_response_snapshot_is_stable() {
        let response = query::ListMessagesResponse {
            messages: vec![query::MessageItem {
                message_id: fixed_uuid("33333333-3333-3333-3333-333333333333"),
                conversation_id: fixed_uuid("11111111-1111-1111-1111-111111111111"),
                sender_id: fixed_uuid("22222222-2222-2222-2222-222222222222"),
                body: "first snapshot message".to_owned(),
                sent_at: fixed_time("2026-02-20T05:25:34Z"),
            }],
            next_cursor: Some("cursor-next".to_owned()),
        };

        assert_snapshot_roundtrip(
            &response,
            r#"{"messages":[{"message_id":"33333333-3333-3333-3333-333333333333","conversation_id":"11111111-1111-1111-1111-111111111111","sender_id":"22222222-2222-2222-2222-222222222222","body":"first snapshot message","sent_at":"2026-02-20T05:25:34Z"}],"next_cursor":"cursor-next"}"#,
        );
    }

    #[test]
    fn list_messages_response_without_next_cursor_snapshot_is_stable() {
        let response = query::ListMessagesResponse {
            messages: vec![query::MessageItem {
                message_id: fixed_uuid("33333333-3333-3333-3333-333333333333"),
                conversation_id: fixed_uuid("11111111-1111-1111-1111-111111111111"),
                sender_id: fixed_uuid("22222222-2222-2222-2222-222222222222"),
                body: "first snapshot message".to_owned(),
                sent_at: fixed_time("2026-02-20T05:25:34Z"),
            }],
            next_cursor: None,
        };

        assert_snapshot_roundtrip(
            &response,
            r#"{"messages":[{"message_id":"33333333-3333-3333-3333-333333333333","conversation_id":"11111111-1111-1111-1111-111111111111","sender_id":"22222222-2222-2222-2222-222222222222","body":"first snapshot message","sent_at":"2026-02-20T05:25:34Z"}]}"#,
        );
    }
}
