use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Op {
    Hello,
    Auth,
    SendMessage,
    Ack,
    Event,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "op", content = "d", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Frame {
    Hello(HelloPayload),
    Auth(AuthPayload),
    SendMessage(SendMessagePayload),
    Ack(AckPayload),
    Event(EventPayload),
}

impl Frame {
    pub const fn op(&self) -> Op {
        match self {
            Self::Hello(_) => Op::Hello,
            Self::Auth(_) => Op::Auth,
            Self::SendMessage(_) => Op::SendMessage,
            Self::Ack(_) => Op::Ack,
            Self::Event(_) => Op::Event,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct HelloPayload {
    pub connection_id: String,
    pub heartbeat_interval_ms: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AuthPayload {
    pub token: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SendMessagePayload {
    pub correlation_id: String,
    pub channel_id: String,
    pub content: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AckStatus {
    Accepted,
    Persisted,
    Failed,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AckPayload {
    pub correlation_id: String,
    pub status: AckStatus,
    pub code: Option<String>,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct EventPayload {
    pub event_type: String,
    pub event: serde_json::Value,
}

#[cfg(test)]
mod tests {
    use super::{
        AckPayload, AckStatus, AuthPayload, EventPayload, Frame, HelloPayload, Op,
        SendMessagePayload,
    };

    fn assert_round_trip(frame: Frame) {
        let serialized = serde_json::to_string(&frame).unwrap();
        let deserialized: Frame = serde_json::from_str(&serialized).unwrap();
        assert_eq!(deserialized, frame);
    }

    #[test]
    fn hello_frame_round_trip() {
        let frame = Frame::Hello(HelloPayload {
            connection_id: "conn-1".to_string(),
            heartbeat_interval_ms: 30_000,
        });
        assert_eq!(frame.op(), Op::Hello);
        assert_round_trip(frame);
    }

    #[test]
    fn auth_frame_round_trip() {
        let frame = Frame::Auth(AuthPayload {
            token: "token-1".to_string(),
        });
        assert_eq!(frame.op(), Op::Auth);
        assert_round_trip(frame);
    }

    #[test]
    fn send_message_frame_round_trip() {
        let frame = Frame::SendMessage(SendMessagePayload {
            correlation_id: "corr-1".to_string(),
            channel_id: "channel-1".to_string(),
            content: "hello".to_string(),
        });
        assert_eq!(frame.op(), Op::SendMessage);
        assert_round_trip(frame);
    }

    #[test]
    fn ack_frame_round_trip() {
        let frame = Frame::Ack(AckPayload {
            correlation_id: "corr-1".to_string(),
            status: AckStatus::Persisted,
            code: None,
            reason: None,
        });
        assert_eq!(frame.op(), Op::Ack);
        assert_round_trip(frame);
    }

    #[test]
    fn event_frame_round_trip() {
        let frame = Frame::Event(EventPayload {
            event_type: "MESSAGE_CREATED".to_string(),
            event: serde_json::json!({
                "id": "msg-1",
                "channel_id": "channel-1"
            }),
        });
        assert_eq!(frame.op(), Op::Event);
        assert_round_trip(frame);
    }

    #[test]
    fn missing_required_field_fails_deserialization() {
        let invalid = serde_json::json!({
            "op": "SEND_MESSAGE",
            "d": {
                "correlation_id": "corr-1",
                "content": "hello"
            }
        });

        let result: Result<Frame, _> = serde_json::from_value(invalid);
        assert!(result.is_err());
    }
}
