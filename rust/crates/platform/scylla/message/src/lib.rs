use std::{collections::HashSet, sync::Arc};

use async_trait::async_trait;
use linklynx_message_api::{
    ListGuildChannelMessagesQueryV1, ListGuildChannelMessagesResponseV1, MessageCursorKeyV1,
    MessageItemV1,
};
use linklynx_message_domain::{MessageBodyRepository, MessageCreateDraft, MessageDomainError};
use scylla::{client::session::Session, value::CqlTimestamp};
use time::{Date, Month, OffsetDateTime};

const DEFAULT_BUCKET_WIDTH_DAYS: i64 = 10;

const SELECT_DESC_SQL: &str =
    "SELECT message_id, author_id, content, version, edited_at, is_deleted, created_at
FROM chat.messages_by_channel
WHERE channel_id = ?
  AND bucket = ?
ORDER BY message_id DESC
LIMIT ?";

const SELECT_DESC_BEFORE_SQL: &str =
    "SELECT message_id, author_id, content, version, edited_at, is_deleted, created_at
FROM chat.messages_by_channel
WHERE channel_id = ?
  AND bucket = ?
  AND (created_at, message_id) < (?, ?)
ORDER BY message_id DESC
LIMIT ?
ALLOW FILTERING";

const SELECT_ASC_SQL: &str =
    "SELECT message_id, author_id, content, version, edited_at, is_deleted, created_at
FROM chat.messages_by_channel
WHERE channel_id = ?
  AND bucket = ?
ORDER BY message_id ASC
LIMIT ?";

const SELECT_ASC_AFTER_SQL: &str =
    "SELECT message_id, author_id, content, version, edited_at, is_deleted, created_at
FROM chat.messages_by_channel
WHERE channel_id = ?
  AND bucket = ?
  AND (created_at, message_id) > (?, ?)
ORDER BY message_id ASC
LIMIT ?
ALLOW FILTERING";

const INSERT_SQL: &str = "INSERT INTO chat.messages_by_channel (
  channel_id,
  bucket,
  message_id,
  author_id,
  content,
  version,
  edited_at,
  is_deleted,
  deleted_at,
  deleted_by,
  created_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) IF NOT EXISTS";

const SELECT_BY_ID_SQL: &str =
    "SELECT message_id, author_id, content, version, edited_at, is_deleted, created_at
FROM chat.messages_by_channel
WHERE channel_id = ?
  AND bucket = ?
  AND message_id = ?";

/// Scylla-backed message repository を表現する。
#[derive(Clone)]
pub struct ScyllaMessageRepository {
    session: Arc<Session>,
}

impl ScyllaMessageRepository {
    /// Scylla-backed repository を生成する。
    /// @param session 初期化済み session
    /// @returns repository
    /// @throws なし
    pub fn new(session: Arc<Session>) -> Self {
        Self { session }
    }

    async fn select_existing_message(
        &self,
        guild_id: i64,
        channel_id: i64,
        bucket: i32,
        message_id: i64,
    ) -> Result<Option<MessageItemV1>, MessageDomainError> {
        let query_result = self
            .session
            .query_unpaged(SELECT_BY_ID_SQL, (channel_id, bucket, message_id))
            .await
            .map_err(|error| {
                MessageDomainError::dependency_unavailable(format!(
                    "message_scylla_select_existing_failed:{error}"
                ))
            })?;
        let rows_result = query_result.into_rows_result().map_err(|error| {
            MessageDomainError::dependency_unavailable(format!(
                "message_scylla_select_existing_rows_failed:{error}"
            ))
        })?;
        let row = rows_result
            .maybe_first_row::<(
                i64,
                i64,
                String,
                i64,
                Option<CqlTimestamp>,
                bool,
                CqlTimestamp,
            )>()
            .map_err(|error| {
                MessageDomainError::dependency_unavailable(format!(
                    "message_scylla_select_existing_deserialize_failed:{error}"
                ))
            })?;

        let scope = MessageScope {
            guild_id,
            channel_id,
        };
        row.map(
            |(message_id, author_id, content, version, edited_at, is_deleted, created_at)| {
                build_message_item(
                    scope,
                    ScyllaMessageRow {
                        message_id,
                        author_id,
                        content,
                        version,
                        edited_at,
                        is_deleted,
                        created_at,
                    },
                )
            },
        )
        .transpose()
    }

    async fn collect_descending_page(
        &self,
        guild_id: i64,
        channel_id: i64,
        query: &ListGuildChannelMessagesQueryV1,
        limit_plus_one: usize,
    ) -> Result<ListGuildChannelMessagesResponseV1, MessageDomainError> {
        let cursor = query
            .before
            .as_deref()
            .map(MessageCursorKeyV1::decode)
            .transpose()
            .map_err(MessageDomainError::from)?;
        let mut bucket = cursor
            .as_ref()
            .map(|value| bucket_from_created_at(&value.created_at))
            .transpose()?
            .unwrap_or_else(current_bucket);
        let mut items = Vec::new();
        let mut seen = HashSet::new();

        loop {
            if items.len() > limit_plus_one {
                break;
            }
            if bucket < 0 {
                break;
            }

            let rows = if let Some(cursor) = cursor.as_ref() {
                if bucket == bucket_from_created_at(&cursor.created_at)? {
                    self.fetch_bucket_desc_before(channel_id, bucket, cursor, limit_plus_one)
                        .await?
                } else {
                    self.fetch_bucket_desc(channel_id, bucket, limit_plus_one)
                        .await?
                }
            } else {
                self.fetch_bucket_desc(channel_id, bucket, limit_plus_one)
                    .await?
            };

            for row in rows {
                if seen.insert(row.message_id) {
                    items.push(row.with_scope(guild_id, channel_id)?);
                }
                if items.len() > limit_plus_one {
                    break;
                }
            }

            if items.len() > limit_plus_one {
                break;
            }
            bucket -= 1;
        }

        build_page_response(items, limit_plus_one, false)
    }

    async fn collect_ascending_page(
        &self,
        guild_id: i64,
        channel_id: i64,
        query: &ListGuildChannelMessagesQueryV1,
        limit_plus_one: usize,
    ) -> Result<ListGuildChannelMessagesResponseV1, MessageDomainError> {
        let cursor = query
            .after
            .as_deref()
            .map(MessageCursorKeyV1::decode)
            .transpose()
            .map_err(MessageDomainError::from)?
            .ok_or_else(|| MessageDomainError::validation("message_after_cursor_required"))?;
        let start_bucket = bucket_from_created_at(&cursor.created_at)?;
        let end_bucket = current_bucket();
        let mut items = Vec::new();
        let mut seen = HashSet::new();

        for bucket in start_bucket..=end_bucket {
            let rows = if bucket == start_bucket {
                self.fetch_bucket_asc_after(channel_id, bucket, &cursor, limit_plus_one)
                    .await?
            } else {
                self.fetch_bucket_asc(channel_id, bucket, limit_plus_one)
                    .await?
            };

            for row in rows {
                if seen.insert(row.message_id) {
                    items.push(row.with_scope(guild_id, channel_id)?);
                }
                if items.len() > limit_plus_one {
                    break;
                }
            }

            if items.len() > limit_plus_one {
                break;
            }
        }

        build_page_response(items, limit_plus_one, true)
    }

    async fn fetch_bucket_desc(
        &self,
        channel_id: i64,
        bucket: i32,
        limit_plus_one: usize,
    ) -> Result<Vec<ScyllaMessageRow>, MessageDomainError> {
        self.fetch_rows(SELECT_DESC_SQL, (channel_id, bucket, limit_plus_one as i32))
            .await
    }

    async fn fetch_bucket_desc_before(
        &self,
        channel_id: i64,
        bucket: i32,
        cursor: &MessageCursorKeyV1,
        limit_plus_one: usize,
    ) -> Result<Vec<ScyllaMessageRow>, MessageDomainError> {
        self.fetch_rows(
            SELECT_DESC_BEFORE_SQL,
            (
                channel_id,
                bucket,
                cql_timestamp_from_created_at(&cursor.created_at)?,
                cursor.message_id,
                limit_plus_one as i32,
            ),
        )
        .await
    }

    async fn fetch_bucket_asc(
        &self,
        channel_id: i64,
        bucket: i32,
        limit_plus_one: usize,
    ) -> Result<Vec<ScyllaMessageRow>, MessageDomainError> {
        self.fetch_rows(SELECT_ASC_SQL, (channel_id, bucket, limit_plus_one as i32))
            .await
    }

    async fn fetch_bucket_asc_after(
        &self,
        channel_id: i64,
        bucket: i32,
        cursor: &MessageCursorKeyV1,
        limit_plus_one: usize,
    ) -> Result<Vec<ScyllaMessageRow>, MessageDomainError> {
        self.fetch_rows(
            SELECT_ASC_AFTER_SQL,
            (
                channel_id,
                bucket,
                cql_timestamp_from_created_at(&cursor.created_at)?,
                cursor.message_id,
                limit_plus_one as i32,
            ),
        )
        .await
    }

    async fn fetch_rows<V: scylla::serialize::row::SerializeRow>(
        &self,
        query: &str,
        values: V,
    ) -> Result<Vec<ScyllaMessageRow>, MessageDomainError> {
        let query_result = self
            .session
            .query_unpaged(query, values)
            .await
            .map_err(|error| {
                MessageDomainError::dependency_unavailable(format!(
                    "message_scylla_query_failed:{error}"
                ))
            })?;
        let rows_result = query_result.into_rows_result().map_err(|error| {
            MessageDomainError::dependency_unavailable(format!(
                "message_scylla_rows_failed:{error}"
            ))
        })?;

        rows_result
            .rows::<(
                i64,
                i64,
                String,
                i64,
                Option<CqlTimestamp>,
                bool,
                CqlTimestamp,
            )>()
            .map_err(|error| {
                MessageDomainError::dependency_unavailable(format!(
                    "message_scylla_rows_deserialize_failed:{error}"
                ))
            })?
            .map(|row| {
                row.map(
                    |(
                        message_id,
                        author_id,
                        content,
                        version,
                        edited_at,
                        is_deleted,
                        created_at,
                    )| {
                        ScyllaMessageRow {
                            message_id,
                            author_id,
                            content,
                            version,
                            edited_at,
                            is_deleted,
                            created_at,
                        }
                    },
                )
                .map_err(|error| {
                    MessageDomainError::dependency_unavailable(format!(
                        "message_scylla_row_decode_failed:{error}"
                    ))
                })
            })
            .collect()
    }
}

#[async_trait]
impl MessageBodyRepository for ScyllaMessageRepository {
    async fn list_guild_channel_messages(
        &self,
        guild_id: i64,
        channel_id: i64,
        query: &ListGuildChannelMessagesQueryV1,
    ) -> Result<ListGuildChannelMessagesResponseV1, MessageDomainError> {
        let limit = usize::from(query.limit.unwrap_or(50));
        let limit_plus_one = limit.saturating_add(1);
        if query.after.is_some() {
            self.collect_ascending_page(guild_id, channel_id, query, limit_plus_one)
                .await
        } else {
            self.collect_descending_page(guild_id, channel_id, query, limit_plus_one)
                .await
        }
    }

    async fn append_guild_channel_message(
        &self,
        draft: MessageCreateDraft,
    ) -> Result<MessageItemV1, MessageDomainError> {
        let bucket = bucket_from_created_at(&draft.created_at)?;
        let created_at = cql_timestamp_from_created_at(&draft.created_at)?;

        let insert_result = self
            .session
            .query_unpaged(
                INSERT_SQL,
                (
                    draft.channel_id,
                    bucket,
                    draft.message_id,
                    draft.author_id,
                    draft.content.as_str(),
                    1_i64,
                    Option::<CqlTimestamp>::None,
                    false,
                    Option::<CqlTimestamp>::None,
                    Option::<i64>::None,
                    created_at,
                ),
            )
            .await;

        if let Err(error) = insert_result {
            if let Some(existing) = self
                .select_existing_message(draft.guild_id, draft.channel_id, bucket, draft.message_id)
                .await?
            {
                return Ok(existing);
            }
            return Err(MessageDomainError::dependency_unavailable(format!(
                "message_scylla_insert_failed:{error}"
            )));
        }

        self.select_existing_message(draft.guild_id, draft.channel_id, bucket, draft.message_id)
            .await?
            .ok_or_else(|| {
                MessageDomainError::dependency_unavailable(
                    "message_scylla_insert_select_missing".to_owned(),
                )
            })
    }
}

#[derive(Debug, Clone)]
struct MessageScope {
    guild_id: i64,
    channel_id: i64,
}

#[derive(Debug, Clone)]
struct ScyllaMessageRow {
    message_id: i64,
    author_id: i64,
    content: String,
    version: i64,
    edited_at: Option<CqlTimestamp>,
    is_deleted: bool,
    created_at: CqlTimestamp,
}

impl ScyllaMessageRow {
    fn with_scope(
        self,
        guild_id: i64,
        channel_id: i64,
    ) -> Result<MessageItemV1, MessageDomainError> {
        build_message_item(
            MessageScope {
                guild_id,
                channel_id,
            },
            self,
        )
    }
}

fn build_message_item(
    scope: MessageScope,
    row: ScyllaMessageRow,
) -> Result<MessageItemV1, MessageDomainError> {
    Ok(MessageItemV1 {
        message_id: row.message_id,
        guild_id: scope.guild_id,
        channel_id: scope.channel_id,
        author_id: row.author_id,
        content: row.content,
        created_at: format_created_at(row.created_at)?,
        version: row.version,
        edited_at: row.edited_at.map(format_created_at).transpose()?,
        is_deleted: row.is_deleted,
    })
}

fn build_page_response(
    mut items: Vec<MessageItemV1>,
    limit_plus_one: usize,
    ascending: bool,
) -> Result<ListGuildChannelMessagesResponseV1, MessageDomainError> {
    let limit = limit_plus_one.saturating_sub(1);
    let has_more = items.len() > limit;
    if has_more {
        items.truncate(limit);
    }
    let cursor = items
        .last()
        .map(|item| MessageCursorKeyV1 {
            created_at: item.created_at.clone(),
            message_id: item.message_id,
        })
        .map(|value| value.encode());
    let (next_before, next_after) = if ascending {
        (None, has_more.then_some(cursor).flatten())
    } else {
        (has_more.then_some(cursor).flatten(), None)
    };

    Ok(ListGuildChannelMessagesResponseV1 {
        items,
        next_before,
        next_after,
        has_more,
    })
}

fn current_bucket() -> i32 {
    bucket_from_unix_day(OffsetDateTime::now_utc().unix_timestamp() / 86_400)
}

fn bucket_from_created_at(created_at: &str) -> Result<i32, MessageDomainError> {
    let year = created_at
        .get(0..4)
        .ok_or_else(|| MessageDomainError::validation("message_created_at_invalid"))?
        .parse::<i32>()
        .map_err(|_| MessageDomainError::validation("message_created_at_invalid"))?;
    let month = created_at
        .get(5..7)
        .ok_or_else(|| MessageDomainError::validation("message_created_at_invalid"))?
        .parse::<u8>()
        .map_err(|_| MessageDomainError::validation("message_created_at_invalid"))?;
    let day = created_at
        .get(8..10)
        .ok_or_else(|| MessageDomainError::validation("message_created_at_invalid"))?
        .parse::<u8>()
        .map_err(|_| MessageDomainError::validation("message_created_at_invalid"))?;
    let date = Date::from_calendar_date(
        year,
        Month::try_from(month)
            .map_err(|_| MessageDomainError::validation("message_created_at_invalid"))?,
        day,
    )
    .map_err(|_| MessageDomainError::validation("message_created_at_invalid"))?;
    Ok(bucket_from_unix_day(
        date.midnight().assume_utc().unix_timestamp() / 86_400,
    ))
}

fn bucket_from_unix_day(unix_day: i64) -> i32 {
    (unix_day / DEFAULT_BUCKET_WIDTH_DAYS) as i32
}

fn cql_timestamp_from_created_at(created_at: &str) -> Result<CqlTimestamp, MessageDomainError> {
    let year = created_at
        .get(0..4)
        .ok_or_else(|| MessageDomainError::validation("message_created_at_invalid"))?
        .parse::<i32>()
        .map_err(|_| MessageDomainError::validation("message_created_at_invalid"))?;
    let month = created_at
        .get(5..7)
        .ok_or_else(|| MessageDomainError::validation("message_created_at_invalid"))?
        .parse::<u8>()
        .map_err(|_| MessageDomainError::validation("message_created_at_invalid"))?;
    let day = created_at
        .get(8..10)
        .ok_or_else(|| MessageDomainError::validation("message_created_at_invalid"))?
        .parse::<u8>()
        .map_err(|_| MessageDomainError::validation("message_created_at_invalid"))?;
    let hour = created_at
        .get(11..13)
        .ok_or_else(|| MessageDomainError::validation("message_created_at_invalid"))?
        .parse::<u8>()
        .map_err(|_| MessageDomainError::validation("message_created_at_invalid"))?;
    let minute = created_at
        .get(14..16)
        .ok_or_else(|| MessageDomainError::validation("message_created_at_invalid"))?
        .parse::<u8>()
        .map_err(|_| MessageDomainError::validation("message_created_at_invalid"))?;
    let second = created_at
        .get(17..19)
        .ok_or_else(|| MessageDomainError::validation("message_created_at_invalid"))?
        .parse::<u8>()
        .map_err(|_| MessageDomainError::validation("message_created_at_invalid"))?;
    let date = Date::from_calendar_date(
        year,
        Month::try_from(month)
            .map_err(|_| MessageDomainError::validation("message_created_at_invalid"))?,
        day,
    )
    .map_err(|_| MessageDomainError::validation("message_created_at_invalid"))?;
    let timestamp = date
        .with_hms(hour, minute, second)
        .map_err(|_| MessageDomainError::validation("message_created_at_invalid"))?
        .assume_utc();
    Ok(CqlTimestamp(
        timestamp.unix_timestamp_nanos() as i64 / 1_000_000,
    ))
}

fn format_created_at(timestamp: CqlTimestamp) -> Result<String, MessageDomainError> {
    let datetime = OffsetDateTime::from_unix_timestamp_nanos(i128::from(timestamp.0) * 1_000_000)
        .map_err(|error| {
        MessageDomainError::dependency_unavailable(format!(
            "message_scylla_timestamp_out_of_range:{error}"
        ))
    })?;
    Ok(format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        datetime.year(),
        datetime.month() as u8,
        datetime.day(),
        datetime.hour(),
        datetime.minute(),
        datetime.second()
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bucket_from_created_at_uses_ten_day_windows() {
        let first = bucket_from_created_at("2026-03-01T00:00:00Z").unwrap();
        let second = bucket_from_created_at("2026-03-05T12:00:00Z").unwrap();
        let third = bucket_from_created_at("2026-03-12T00:00:00Z").unwrap();

        assert_eq!(first, second);
        assert!(third >= second);
    }

    #[test]
    fn build_page_response_sets_next_after_for_ascending_pages() {
        let response = build_page_response(
            vec![
                MessageItemV1 {
                    message_id: 1,
                    guild_id: 10,
                    channel_id: 20,
                    author_id: 30,
                    content: "a".to_owned(),
                    created_at: "2026-03-08T09:00:00Z".to_owned(),
                    version: 1,
                    edited_at: None,
                    is_deleted: false,
                },
                MessageItemV1 {
                    message_id: 2,
                    guild_id: 10,
                    channel_id: 20,
                    author_id: 30,
                    content: "b".to_owned(),
                    created_at: "2026-03-08T09:01:00Z".to_owned(),
                    version: 1,
                    edited_at: None,
                    is_deleted: false,
                },
            ],
            2,
            true,
        )
        .unwrap();

        assert!(response.next_after.is_some());
        assert!(response.next_before.is_none());
    }
}
