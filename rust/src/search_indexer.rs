use serde_json::Value;
use std::collections::HashMap;
use thiserror::Error;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SearchDocument {
    pub message_id: i64,
    pub channel_id: i64,
    pub guild_id: Option<i64>,
    pub author_id: i64,
    pub content: String,
    pub version: i64,
    pub is_deleted: bool,
}

#[derive(Debug, Error)]
pub enum SearchIndexError {
    #[error("missing field in payload: {0}")]
    MissingField(&'static str),
    #[error("invalid field type in payload: {0}")]
    InvalidField(&'static str),
}

pub trait SearchStore {
    fn upsert_if_newer(&mut self, doc: SearchDocument) -> bool;
}

#[derive(Default)]
pub struct InMemorySearchStore {
    docs: HashMap<i64, SearchDocument>,
}

impl InMemorySearchStore {
    pub fn get(&self, message_id: i64) -> Option<&SearchDocument> {
        self.docs.get(&message_id)
    }
}

impl SearchStore for InMemorySearchStore {
    fn upsert_if_newer(&mut self, doc: SearchDocument) -> bool {
        match self.docs.get(&doc.message_id) {
            Some(current) if current.version >= doc.version => false,
            _ => {
                self.docs.insert(doc.message_id, doc);
                true
            }
        }
    }
}

pub fn index_event<S: SearchStore>(
    store: &mut S,
    event_type: &str,
    payload: &Value,
) -> Result<bool, SearchIndexError> {
    let doc = parse_document(event_type, payload)?;
    Ok(store.upsert_if_newer(doc))
}

fn parse_document(event_type: &str, payload: &Value) -> Result<SearchDocument, SearchIndexError> {
    let message = payload
        .get("message")
        .ok_or(SearchIndexError::MissingField("message"))?;

    let message_id = to_i64(message, "message_id")?;
    let channel_id = to_i64(message, "channel_id")?;
    let author_id = to_i64(message, "author_id")?;
    let version = to_i64(message, "version")?;
    let guild_id = optional_i64(message, "guild_id")?;
    let content = message
        .get("content")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();

    let is_deleted = if event_type == "MessageDeleted" {
        true
    } else {
        message
            .get("is_deleted")
            .and_then(Value::as_bool)
            .unwrap_or(false)
    };

    Ok(SearchDocument {
        message_id,
        channel_id,
        guild_id,
        author_id,
        content,
        version,
        is_deleted,
    })
}

fn to_i64(value: &Value, key: &'static str) -> Result<i64, SearchIndexError> {
    value
        .get(key)
        .and_then(Value::as_i64)
        .ok_or(SearchIndexError::InvalidField(key))
}

fn optional_i64(value: &Value, key: &'static str) -> Result<Option<i64>, SearchIndexError> {
    match value.get(key) {
        Some(Value::Null) | None => Ok(None),
        Some(other) => other
            .as_i64()
            .map(Some)
            .ok_or(SearchIndexError::InvalidField(key)),
    }
}

#[cfg(test)]
mod tests {
    use super::{index_event, InMemorySearchStore};
    use crate::search_indexer::SearchStore;
    use serde_json::json;

    fn base_payload(version: i64, content: &str) -> serde_json::Value {
        json!({
          "message": {
            "message_id": 1001,
            "channel_id": 2002,
            "guild_id": 3003,
            "author_id": 4004,
            "version": version,
            "content": content,
            "is_deleted": false
          }
        })
    }

    #[test]
    fn rejects_out_of_order_update_by_version() {
        let mut store = InMemorySearchStore::default();
        let v2 = base_payload(2, "new");
        let v1 = base_payload(1, "old");

        let applied_v2 = index_event(&mut store, "MessageUpdated", &v2).unwrap();
        let applied_v1 = index_event(&mut store, "MessageUpdated", &v1).unwrap();

        assert!(applied_v2);
        assert!(!applied_v1);
        assert_eq!(store.get(1001).unwrap().version, 2);
        assert_eq!(store.get(1001).unwrap().content, "new");
    }

    #[test]
    fn writes_tombstone_on_delete() {
        let mut store = InMemorySearchStore::default();
        let created = base_payload(1, "hello");
        let deleted = base_payload(2, "ignored");

        let _ = index_event(&mut store, "MessageCreated", &created).unwrap();
        let _ = index_event(&mut store, "MessageDeleted", &deleted).unwrap();

        let got = store.get(1001).unwrap();
        assert_eq!(got.version, 2);
        assert!(got.is_deleted);
    }

    #[test]
    fn store_rejects_same_or_older_version_directly() {
        let mut store = InMemorySearchStore::default();
        let first = super::SearchDocument {
            message_id: 1,
            channel_id: 1,
            guild_id: None,
            author_id: 1,
            content: "a".to_string(),
            version: 10,
            is_deleted: false,
        };
        assert!(store.upsert_if_newer(first));

        let older = super::SearchDocument {
            message_id: 1,
            channel_id: 1,
            guild_id: None,
            author_id: 1,
            content: "b".to_string(),
            version: 9,
            is_deleted: false,
        };
        assert!(!store.upsert_if_newer(older));
    }
}
