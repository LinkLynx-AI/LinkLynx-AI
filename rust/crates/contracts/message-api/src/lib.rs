use serde::{Deserialize, Serialize};
use thiserror::Error;

pub const DEFAULT_HISTORY_LIMIT_V1: u16 = 50;
pub const MAX_HISTORY_LIMIT_V1: u16 = 100;

/// メッセージの REST/WS 共有スナップショットを表現する。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MessageItemV1 {
    pub message_id: i64,
    pub guild_id: i64,
    pub channel_id: i64,
    pub author_id: i64,
    pub content: String,
    pub created_at: String,
    pub version: i64,
    #[serde(default)]
    pub edited_at: Option<String>,
    #[serde(default)]
    pub is_deleted: bool,
}

/// メッセージ作成リクエストを表現する。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CreateGuildChannelMessageRequestV1 {
    pub content: String,
}

/// メッセージ作成レスポンスを表現する。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CreateGuildChannelMessageResponseV1 {
    pub message: MessageItemV1,
}

/// メッセージ一覧クエリを表現する。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct ListGuildChannelMessagesQueryV1 {
    pub limit: Option<u16>,
    pub before: Option<String>,
    pub after: Option<String>,
}

/// メッセージ一覧レスポンスを表現する。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ListGuildChannelMessagesResponseV1 {
    pub items: Vec<MessageItemV1>,
    pub next_before: Option<String>,
    pub next_after: Option<String>,
    pub has_more: bool,
}

/// カーソル比較キーを表現する。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MessageCursorKeyV1 {
    pub created_at: String,
    pub message_id: i64,
}

/// メッセージ API 契約の入力エラーを表現する。
#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum MessageApiError {
    #[error("content is required")]
    EmptyContent,
    #[error("limit must be between 1 and 100")]
    InvalidLimit,
    #[error("before and after cannot be used together")]
    CursorConflict,
    #[error("cursor is invalid")]
    InvalidCursor,
}

impl MessageApiError {
    /// エラーを validation reason に変換する。
    /// @param self メッセージAPIエラー
    /// @returns 既存 API エラー応答に埋め込む reason
    /// @throws なし
    pub fn reason_code(&self) -> &'static str {
        match self {
            Self::EmptyContent => "message_content_required",
            Self::InvalidLimit => "message_limit_out_of_range",
            Self::CursorConflict => "message_cursor_conflict",
            Self::InvalidCursor => "message_cursor_invalid",
        }
    }
}

impl MessageCursorKeyV1 {
    /// カーソルキーを opaque 文字列へエンコードする。
    /// @param self カーソルキー
    /// @returns opaque cursor 文字列
    /// @throws なし
    pub fn encode(&self) -> String {
        let bytes =
            serde_json::to_vec(self).expect("MessageCursorKeyV1 serialization must succeed");
        let mut encoded = String::with_capacity(bytes.len() * 2 + 3);
        encoded.push_str("v1.");
        for byte in bytes {
            encoded.push(encode_hex_digit(byte >> 4));
            encoded.push(encode_hex_digit(byte & 0x0f));
        }
        encoded
    }

    /// opaque cursor 文字列をカーソルキーへデコードする。
    /// @param value opaque cursor 文字列
    /// @returns デコード済みカーソルキー
    /// @throws MessageApiError 形式不正時
    pub fn decode(value: &str) -> Result<Self, MessageApiError> {
        let Some(hex) = value.strip_prefix("v1.") else {
            return Err(MessageApiError::InvalidCursor);
        };
        if hex.is_empty() || hex.len() % 2 != 0 {
            return Err(MessageApiError::InvalidCursor);
        }

        let mut bytes = Vec::with_capacity(hex.len() / 2);
        let mut chars = hex.chars();
        while let (Some(high), Some(low)) = (chars.next(), chars.next()) {
            let high = decode_hex_digit(high).ok_or(MessageApiError::InvalidCursor)?;
            let low = decode_hex_digit(low).ok_or(MessageApiError::InvalidCursor)?;
            bytes.push((high << 4) | low);
        }

        serde_json::from_slice::<Self>(&bytes).map_err(|_| MessageApiError::InvalidCursor)
    }
}

impl MessageItemV1 {
    fn cursor_key(&self) -> MessageCursorKeyV1 {
        MessageCursorKeyV1 {
            created_at: self.created_at.clone(),
            message_id: self.message_id,
        }
    }
}

/// メッセージ作成入力を検証する。
/// @param request 作成リクエスト
/// @returns 検証成功時は `Ok(())`
/// @throws MessageApiError content が空白時
pub fn validate_create_request(
    request: &CreateGuildChannelMessageRequestV1,
) -> Result<(), MessageApiError> {
    if request.content.trim().is_empty() {
        return Err(MessageApiError::EmptyContent);
    }
    Ok(())
}

/// 履歴クエリを正規化する。
/// @param query 一覧クエリ
/// @returns デフォルト補完済みクエリ
/// @throws MessageApiError limit 範囲不正または before/after 競合時
pub fn normalize_list_query(
    query: &ListGuildChannelMessagesQueryV1,
) -> Result<ListGuildChannelMessagesQueryV1, MessageApiError> {
    if query.before.is_some() && query.after.is_some() {
        return Err(MessageApiError::CursorConflict);
    }

    let limit = match query.limit {
        Some(0) => return Err(MessageApiError::InvalidLimit),
        Some(limit) if limit > MAX_HISTORY_LIMIT_V1 => return Err(MessageApiError::InvalidLimit),
        Some(limit) => limit,
        None => DEFAULT_HISTORY_LIMIT_V1,
    };

    Ok(ListGuildChannelMessagesQueryV1 {
        limit: Some(limit),
        before: query.before.clone(),
        after: query.after.clone(),
    })
}

/// 履歴ページング契約をメモリ上のメッセージ列へ適用する。
/// @param items newest-first に整列済みのメッセージ列
/// @param query 一覧クエリ
/// @returns カーソル規約を適用したレスポンス
/// @throws MessageApiError query または cursor 不正時
pub fn paginate_messages(
    items: &[MessageItemV1],
    query: &ListGuildChannelMessagesQueryV1,
) -> Result<ListGuildChannelMessagesResponseV1, MessageApiError> {
    let normalized = normalize_list_query(query)?;
    let limit = normalized
        .limit
        .expect("normalize_list_query must populate limit") as usize;

    let response = if let Some(after) = normalized.after.as_deref() {
        let cursor = MessageCursorKeyV1::decode(after)?;
        let mut newer = items
            .iter()
            .filter(|item| compare_message_to_cursor(item, &cursor).is_gt())
            .cloned()
            .collect::<Vec<_>>();
        newer.reverse();
        build_page_response(newer, limit, CursorDirection::After)
    } else {
        let filtered = if let Some(before) = normalized.before.as_deref() {
            let cursor = MessageCursorKeyV1::decode(before)?;
            items
                .iter()
                .filter(|item| compare_message_to_cursor(item, &cursor).is_lt())
                .cloned()
                .collect::<Vec<_>>()
        } else {
            items.to_vec()
        };
        build_page_response(filtered, limit, CursorDirection::Before)
    };

    Ok(response)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum CursorDirection {
    Before,
    After,
}

fn build_page_response(
    mut items: Vec<MessageItemV1>,
    limit: usize,
    direction: CursorDirection,
) -> ListGuildChannelMessagesResponseV1 {
    let has_more = items.len() > limit;
    if has_more {
        items.truncate(limit);
    }

    let cursor = items
        .last()
        .map(MessageItemV1::cursor_key)
        .map(|key| key.encode());
    let (next_before, next_after) = match direction {
        CursorDirection::Before => (cursor, None),
        CursorDirection::After => (None, cursor),
    };

    ListGuildChannelMessagesResponseV1 {
        items,
        next_before: has_more.then_some(next_before).flatten(),
        next_after: has_more.then_some(next_after).flatten(),
        has_more,
    }
}

fn compare_message_to_cursor(
    item: &MessageItemV1,
    cursor: &MessageCursorKeyV1,
) -> std::cmp::Ordering {
    match item.created_at.cmp(&cursor.created_at) {
        std::cmp::Ordering::Equal => item.message_id.cmp(&cursor.message_id),
        order => order,
    }
}

fn encode_hex_digit(value: u8) -> char {
    match value {
        0..=9 => (b'0' + value) as char,
        10..=15 => (b'a' + (value - 10)) as char,
        _ => unreachable!("hex digit must be in 0..=15"),
    }
}

fn decode_hex_digit(value: char) -> Option<u8> {
    match value {
        '0'..='9' => Some(value as u8 - b'0'),
        'a'..='f' => Some(value as u8 - b'a' + 10),
        'A'..='F' => Some(value as u8 - b'A' + 10),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_messages() -> Vec<MessageItemV1> {
        vec![
            MessageItemV1 {
                message_id: 120_110,
                guild_id: 10,
                channel_id: 20,
                author_id: 30,
                content: "latest".to_owned(),
                created_at: "2026-02-21T10:00:06Z".to_owned(),
                version: 1,
                edited_at: None,
                is_deleted: false,
            },
            MessageItemV1 {
                message_id: 120_108,
                guild_id: 10,
                channel_id: 20,
                author_id: 31,
                content: "same-ts-newer".to_owned(),
                created_at: "2026-02-21T10:00:05Z".to_owned(),
                version: 1,
                edited_at: None,
                is_deleted: false,
            },
            MessageItemV1 {
                message_id: 120_107,
                guild_id: 10,
                channel_id: 20,
                author_id: 32,
                content: "same-ts-older".to_owned(),
                created_at: "2026-02-21T10:00:05Z".to_owned(),
                version: 1,
                edited_at: None,
                is_deleted: false,
            },
            MessageItemV1 {
                message_id: 120_105,
                guild_id: 10,
                channel_id: 20,
                author_id: 33,
                content: "older".to_owned(),
                created_at: "2026-02-21T10:00:04Z".to_owned(),
                version: 1,
                edited_at: None,
                is_deleted: false,
            },
            MessageItemV1 {
                message_id: 120_102,
                guild_id: 10,
                channel_id: 20,
                author_id: 34,
                content: "oldest".to_owned(),
                created_at: "2026-02-21T10:00:03Z".to_owned(),
                version: 1,
                edited_at: None,
                is_deleted: false,
            },
        ]
    }

    #[test]
    fn cursor_roundtrip_preserves_created_at_and_message_id() {
        let cursor = MessageCursorKeyV1 {
            created_at: "2026-02-21T10:00:05Z".to_owned(),
            message_id: 120_107,
        };

        let encoded = cursor.encode();
        let decoded = MessageCursorKeyV1::decode(&encoded).unwrap();

        assert_eq!(decoded, cursor);
        assert!(encoded.starts_with("v1."));
    }

    #[test]
    fn cursor_decode_rejects_tampered_value() {
        let error = MessageCursorKeyV1::decode("v1.not-hex").unwrap_err();
        assert_eq!(error, MessageApiError::InvalidCursor);
    }

    #[test]
    fn paginate_messages_returns_initial_page_with_next_before() {
        let response = paginate_messages(
            &sample_messages(),
            &ListGuildChannelMessagesQueryV1 {
                limit: Some(3),
                before: None,
                after: None,
            },
        )
        .unwrap();

        assert_eq!(
            response
                .items
                .iter()
                .map(|item| item.message_id)
                .collect::<Vec<_>>(),
            vec![120_110, 120_108, 120_107]
        );
        assert_eq!(response.next_after, None);
        assert!(response.next_before.is_some());
        assert!(response.has_more);
    }

    #[test]
    fn paginate_messages_returns_before_page_without_overlap() {
        let response = paginate_messages(
            &sample_messages(),
            &ListGuildChannelMessagesQueryV1 {
                limit: Some(2),
                before: Some(
                    MessageCursorKeyV1 {
                        created_at: "2026-02-21T10:00:05Z".to_owned(),
                        message_id: 120_107,
                    }
                    .encode(),
                ),
                after: None,
            },
        )
        .unwrap();

        assert_eq!(
            response
                .items
                .iter()
                .map(|item| item.message_id)
                .collect::<Vec<_>>(),
            vec![120_105, 120_102]
        );
        assert_eq!(response.next_after, None);
        assert_eq!(response.next_before, None);
        assert!(!response.has_more);
    }

    #[test]
    fn paginate_messages_returns_after_page_in_ascending_order() {
        let response = paginate_messages(
            &sample_messages(),
            &ListGuildChannelMessagesQueryV1 {
                limit: Some(1),
                before: None,
                after: Some(
                    MessageCursorKeyV1 {
                        created_at: "2026-02-21T10:00:05Z".to_owned(),
                        message_id: 120_107,
                    }
                    .encode(),
                ),
            },
        )
        .unwrap();

        assert_eq!(
            response
                .items
                .iter()
                .map(|item| item.message_id)
                .collect::<Vec<_>>(),
            vec![120_108]
        );
        assert!(response.next_after.is_some());
        assert_eq!(response.next_before, None);
        assert!(response.has_more);
    }

    #[test]
    fn normalize_list_query_rejects_before_and_after_conflict() {
        let error = normalize_list_query(&ListGuildChannelMessagesQueryV1 {
            limit: Some(10),
            before: Some("cursor-a".to_owned()),
            after: Some("cursor-b".to_owned()),
        })
        .unwrap_err();

        assert_eq!(error, MessageApiError::CursorConflict);
    }

    #[test]
    fn validate_create_request_rejects_blank_content() {
        let error = validate_create_request(&CreateGuildChannelMessageRequestV1 {
            content: "   ".to_owned(),
        })
        .unwrap_err();

        assert_eq!(error, MessageApiError::EmptyContent);
    }

    #[test]
    fn message_item_deserialize_ignores_unknown_fields() {
        let payload = serde_json::json!({
            "message_id": 1,
            "guild_id": 2,
            "channel_id": 3,
            "author_id": 4,
            "content": "hello",
            "created_at": "2026-02-21T10:00:06Z",
            "version": 1,
            "edited_at": null,
            "is_deleted": false,
            "metadata": { "future": true }
        });

        let parsed = serde_json::from_value::<MessageItemV1>(payload).unwrap();
        assert_eq!(parsed.message_id, 1);
        assert!(!parsed.is_deleted);
    }
}
