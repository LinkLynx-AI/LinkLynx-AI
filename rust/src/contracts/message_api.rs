use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub mod command {
    use super::*;

    #[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
    pub struct SendMessageRequest {
        pub conversation_id: Uuid,
        pub sender_id: Uuid,
        pub body: String,
    }

    #[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
    pub struct SendMessageResponse {
        pub message_id: Uuid,
        pub conversation_id: Uuid,
        pub sender_id: Uuid,
        pub body: String,
        pub sent_at: DateTime<Utc>,
    }
}

pub mod query {
    use super::*;

    #[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
    pub struct ListMessagesRequest {
        pub conversation_id: Uuid,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        pub cursor: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        pub limit: Option<u32>,
    }

    #[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
    pub struct MessageItem {
        pub message_id: Uuid,
        pub conversation_id: Uuid,
        pub sender_id: Uuid,
        pub body: String,
        pub sent_at: DateTime<Utc>,
    }

    #[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
    pub struct ListMessagesResponse {
        pub messages: Vec<MessageItem>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        pub next_cursor: Option<String>,
    }
}

#[cfg(test)]
mod tests {
    use super::{command, query};
    use chrono::{DateTime, Utc};
    use uuid::Uuid;

    fn fixed_time() -> DateTime<Utc> {
        DateTime::parse_from_rfc3339("2026-02-20T05:25:34Z")
            .expect("valid rfc3339")
            .with_timezone(&Utc)
    }

    #[test]
    fn send_message_request_requires_body() {
        let json = serde_json::json!({
            "conversation_id": Uuid::new_v4(),
            "sender_id": Uuid::new_v4()
        });

        let result: Result<command::SendMessageRequest, _> = serde_json::from_value(json);
        assert!(result.is_err());
    }

    #[test]
    fn send_message_roundtrip_with_response() {
        let request = command::SendMessageRequest {
            conversation_id: Uuid::new_v4(),
            sender_id: Uuid::new_v4(),
            body: "hello".to_string(),
        };
        let serialized_request = serde_json::to_string(&request).expect("serialize request");
        let deserialized_request: command::SendMessageRequest =
            serde_json::from_str(&serialized_request).expect("deserialize request");
        assert_eq!(request, deserialized_request);

        let response = command::SendMessageResponse {
            message_id: Uuid::new_v4(),
            conversation_id: request.conversation_id,
            sender_id: request.sender_id,
            body: request.body.clone(),
            sent_at: fixed_time(),
        };
        let serialized_response = serde_json::to_string(&response).expect("serialize response");
        let deserialized_response: command::SendMessageResponse =
            serde_json::from_str(&serialized_response).expect("deserialize response");
        assert_eq!(response, deserialized_response);
    }

    #[test]
    fn list_messages_request_requires_conversation_id() {
        let json = serde_json::json!({
            "cursor": "cursor-1",
            "limit": 20
        });

        let result: Result<query::ListMessagesRequest, _> = serde_json::from_value(json);
        assert!(result.is_err());
    }

    #[test]
    fn list_messages_roundtrip_with_response() {
        let request = query::ListMessagesRequest {
            conversation_id: Uuid::new_v4(),
            cursor: Some("cursor-1".to_string()),
            limit: Some(50),
        };
        let serialized_request = serde_json::to_string(&request).expect("serialize request");
        let deserialized_request: query::ListMessagesRequest =
            serde_json::from_str(&serialized_request).expect("deserialize request");
        assert_eq!(request, deserialized_request);

        let response = query::ListMessagesResponse {
            messages: vec![query::MessageItem {
                message_id: Uuid::new_v4(),
                conversation_id: request.conversation_id,
                sender_id: Uuid::new_v4(),
                body: "first message".to_string(),
                sent_at: fixed_time(),
            }],
            next_cursor: Some("cursor-2".to_string()),
        };
        let serialized_response = serde_json::to_string(&response).expect("serialize response");
        let deserialized_response: query::ListMessagesResponse =
            serde_json::from_str(&serialized_response).expect("deserialize response");
        assert_eq!(response, deserialized_response);
    }
}
