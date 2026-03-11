use std::{collections::HashSet, sync::Arc};

use async_trait::async_trait;
use linklynx_message_api::{
    ListGuildChannelMessagesQueryV1, ListGuildChannelMessagesResponseV1, MessageCursorKeyV1,
    MessageItemV1,
};
use linklynx_message_domain::{
    GuildChannelContext, MessageBodyStore, MessageStoreUpdateResult, MessageUsecaseError,
};
use scylla::{
    client::session::Session,
    value::{CqlTimestamp, CqlValue, Row},
};
use time::{format_description::well_known::Rfc3339, Date, Month, OffsetDateTime};

const INSERT_MESSAGE_SQL_TEMPLATE: &str = "
    INSERT INTO chat.messages_by_channel (
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
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    IF NOT EXISTS";
const SELECT_MESSAGE_SQL_TEMPLATE: &str = "
    SELECT
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
    FROM chat.messages_by_channel
    WHERE channel_id = ?
      AND bucket = ?
      AND message_id = ?";
const UPDATE_MESSAGE_SQL_TEMPLATE: &str = "
    UPDATE chat.messages_by_channel
    SET
      content = ?,
      version = ?,
      edited_at = ?,
      is_deleted = ?,
      deleted_at = ?,
      deleted_by = ?
    WHERE channel_id = ?
      AND bucket = ?
      AND message_id = ?
    IF version = ?";
const LIST_BUCKET_DESC_SQL_TEMPLATE: &str = "
    SELECT
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
    FROM chat.messages_by_channel
    WHERE channel_id = ?
      AND bucket = ?
    ORDER BY message_id DESC
    LIMIT ?";
const LIST_BUCKET_ASC_SQL_TEMPLATE: &str = "
    SELECT
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
    FROM chat.messages_by_channel
    WHERE channel_id = ?
      AND bucket = ?
    ORDER BY message_id ASC
    LIMIT ?";
const LIST_BUCKET_BEFORE_SQL_TEMPLATE: &str = "
    SELECT
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
    FROM chat.messages_by_channel
    WHERE channel_id = ?
      AND bucket = ?
      AND message_id < ?
    ORDER BY message_id DESC
    LIMIT ?
    ALLOW FILTERING";
const LIST_BUCKET_AFTER_SQL_TEMPLATE: &str = "
    SELECT
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
    FROM chat.messages_by_channel
    WHERE channel_id = ?
      AND bucket = ?
      AND message_id > ?
    ORDER BY message_id ASC
    LIMIT ?
    ALLOW FILTERING";

type ScyllaMessageRow = (
    i64,
    i32,
    i64,
    i64,
    String,
    i64,
    Option<CqlTimestamp>,
    bool,
    Option<CqlTimestamp>,
    Option<i64>,
    CqlTimestamp,
);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum CursorDirection {
    Before,
    After,
}

/// Scylla-backed message body store を表現する。
#[derive(Clone)]
pub struct ScyllaMessageStore {
    session: Arc<Session>,
    insert_message_sql: String,
    select_message_sql: String,
    update_message_sql: String,
    list_bucket_desc_sql: String,
    list_bucket_asc_sql: String,
    list_bucket_before_sql: String,
    list_bucket_after_sql: String,
}

impl ScyllaMessageStore {
    /// message store を生成する。
    /// @param session 初期化済み Scylla session
    /// @returns message store
    /// @throws なし
    pub fn new(session: Session, keyspace: impl Into<String>) -> Result<Self, MessageUsecaseError> {
        let keyspace = keyspace.into();
        validate_keyspace_identifier(&keyspace)?;
        Ok(Self {
            session: Arc::new(session),
            insert_message_sql: qualify_messages_by_channel_sql(
                INSERT_MESSAGE_SQL_TEMPLATE,
                &keyspace,
            ),
            select_message_sql: qualify_messages_by_channel_sql(
                SELECT_MESSAGE_SQL_TEMPLATE,
                &keyspace,
            ),
            update_message_sql: qualify_messages_by_channel_sql(
                UPDATE_MESSAGE_SQL_TEMPLATE,
                &keyspace,
            ),
            list_bucket_desc_sql: qualify_messages_by_channel_sql(
                LIST_BUCKET_DESC_SQL_TEMPLATE,
                &keyspace,
            ),
            list_bucket_asc_sql: qualify_messages_by_channel_sql(
                LIST_BUCKET_ASC_SQL_TEMPLATE,
                &keyspace,
            ),
            list_bucket_before_sql: qualify_messages_by_channel_sql(
                LIST_BUCKET_BEFORE_SQL_TEMPLATE,
                &keyspace,
            ),
            list_bucket_after_sql: qualify_messages_by_channel_sql(
                LIST_BUCKET_AFTER_SQL_TEMPLATE,
                &keyspace,
            ),
        })
    }

    async fn select_message(
        &self,
        guild_id: i64,
        channel_id: i64,
        bucket: i32,
        message_id: i64,
    ) -> Result<Option<MessageItemV1>, MessageUsecaseError> {
        let query_result = self
            .session
            .query_unpaged(
                self.select_message_sql.as_str(),
                (channel_id, bucket, message_id),
            )
            .await
            .map_err(|error| {
                MessageUsecaseError::dependency_unavailable(format!(
                    "message_select_failed:{error}"
                ))
            })?;
        let rows_result = query_result.into_rows_result().map_err(|error| {
            MessageUsecaseError::dependency_unavailable(format!(
                "message_select_rows_unavailable:{error}"
            ))
        })?;
        let row = rows_result
            .maybe_first_row::<ScyllaMessageRow>()
            .map_err(|error| {
                MessageUsecaseError::dependency_unavailable(format!(
                    "message_select_deserialize_failed:{error}"
                ))
            })?;
        row.map(|value| map_row_to_message(guild_id, value))
            .transpose()
    }

    /// LWT update の `[applied]` 列を抽出する。
    /// @param row Scylla が返した生 row
    /// @returns 更新適用時は `true`
    /// @throws MessageUsecaseError `[applied]` 列が欠落または bool 以外の場合
    fn lwt_applied_from_row(row: Row) -> Result<bool, MessageUsecaseError> {
        match row.columns.into_iter().next() {
            Some(Some(CqlValue::Boolean(applied))) => Ok(applied),
            Some(Some(other)) => Err(MessageUsecaseError::dependency_unavailable(format!(
                "message_update_decode_failed:unexpected_applied_column:{other:?}"
            ))),
            Some(None) => Err(MessageUsecaseError::dependency_unavailable(
                "message_update_decode_failed:null_applied_column".to_string(),
            )),
            None => Err(MessageUsecaseError::dependency_unavailable(
                "message_update_decode_failed:missing_applied_column".to_string(),
            )),
        }
    }

    async fn query_messages<V>(
        &self,
        guild_id: i64,
        query: &str,
        values: V,
    ) -> Result<Vec<MessageItemV1>, MessageUsecaseError>
    where
        V: scylla::serialize::row::SerializeRow,
    {
        let query_result = self
            .session
            .query_unpaged(query, values)
            .await
            .map_err(|error| {
                MessageUsecaseError::dependency_unavailable(format!(
                    "message_list_query_failed:{error}"
                ))
            })?;
        let rows_result = query_result.into_rows_result().map_err(|error| {
            MessageUsecaseError::dependency_unavailable(format!(
                "message_list_rows_unavailable:{error}"
            ))
        })?;

        rows_result
            .rows::<ScyllaMessageRow>()
            .map_err(|error| {
                MessageUsecaseError::dependency_unavailable(format!(
                    "message_list_deserialize_failed:{error}"
                ))
            })?
            .map(|row| {
                row.map_err(|error| {
                    MessageUsecaseError::dependency_unavailable(format!(
                        "message_row_decode_failed:{error}"
                    ))
                })
            })
            .map(|row| row.and_then(|value| map_row_to_message(guild_id, value)))
            .collect()
    }

    async fn select_message_across_buckets(
        &self,
        context: &GuildChannelContext,
        message_id: i64,
    ) -> Result<Option<(i32, MessageItemV1)>, MessageUsecaseError> {
        let lower_bucket = bucket_from_timestamp(&context.created_at)?;
        let upper_bucket = resolve_upper_bucket(context, OffsetDateTime::now_utc())?;
        let mut bucket = upper_bucket;
        loop {
            if let Some(message) = self
                .select_message(context.guild_id, context.channel_id, bucket, message_id)
                .await?
            {
                return Ok(Some((bucket, message)));
            }
            if bucket == lower_bucket {
                break;
            }
            bucket = previous_bucket(bucket)?;
        }

        Ok(None)
    }

    async fn query_bucket_desc(
        &self,
        guild_id: i64,
        channel_id: i64,
        bucket: i32,
        limit: usize,
    ) -> Result<Vec<MessageItemV1>, MessageUsecaseError> {
        self.query_messages(
            guild_id,
            &self.list_bucket_desc_sql,
            (channel_id, bucket, limit as i32),
        )
        .await
    }

    async fn query_bucket_asc(
        &self,
        guild_id: i64,
        channel_id: i64,
        bucket: i32,
        limit: usize,
    ) -> Result<Vec<MessageItemV1>, MessageUsecaseError> {
        self.query_messages(
            guild_id,
            &self.list_bucket_asc_sql,
            (channel_id, bucket, limit as i32),
        )
        .await
    }

    async fn query_bucket_before(
        &self,
        guild_id: i64,
        channel_id: i64,
        bucket: i32,
        cursor: &MessageCursorKeyV1,
        limit: usize,
    ) -> Result<Vec<MessageItemV1>, MessageUsecaseError> {
        self.query_messages(
            guild_id,
            &self.list_bucket_before_sql,
            (channel_id, bucket, cursor.message_id, limit as i32),
        )
        .await
    }

    async fn query_bucket_after(
        &self,
        guild_id: i64,
        channel_id: i64,
        bucket: i32,
        cursor: &MessageCursorKeyV1,
        limit: usize,
    ) -> Result<Vec<MessageItemV1>, MessageUsecaseError> {
        self.query_messages(
            guild_id,
            &self.list_bucket_after_sql,
            (channel_id, bucket, cursor.message_id, limit as i32),
        )
        .await
    }

    async fn insert_message(
        &self,
        message: &MessageItemV1,
        bucket: i32,
        created_at: OffsetDateTime,
        edited_at: Option<OffsetDateTime>,
        deleted_at: Option<OffsetDateTime>,
        deleted_by: Option<i64>,
    ) -> Result<(), MessageUsecaseError> {
        self.session
            .query_unpaged(
                self.insert_message_sql.as_str(),
                (
                    message.channel_id,
                    bucket,
                    message.message_id,
                    message.author_id,
                    &message.content,
                    message.version,
                    edited_at.map(timestamp_to_cql),
                    message.is_deleted,
                    deleted_at.map(timestamp_to_cql),
                    deleted_by,
                    timestamp_to_cql(created_at),
                ),
            )
            .await
            .map(|_| ())
            .map_err(|error| {
                MessageUsecaseError::dependency_unavailable(format!(
                    "message_append_insert_failed:{error}"
                ))
            })
    }

    async fn conditional_update_message(
        &self,
        message: &MessageItemV1,
        bucket: i32,
        expected_version: i64,
        actor_id: i64,
    ) -> Result<MessageStoreUpdateResult, MessageUsecaseError> {
        let edited_at = message
            .edited_at
            .as_deref()
            .map(parse_rfc3339_timestamp)
            .transpose()?;
        let deleted_at = if message.is_deleted { edited_at } else { None };
        let deleted_by = message.is_deleted.then_some(actor_id);
        let query_result = self
            .session
            .query_unpaged(
                self.update_message_sql.as_str(),
                (
                    &message.content,
                    message.version,
                    edited_at.map(timestamp_to_cql),
                    message.is_deleted,
                    deleted_at.map(timestamp_to_cql),
                    deleted_by,
                    message.channel_id,
                    bucket,
                    message.message_id,
                    expected_version,
                ),
            )
            .await
            .map_err(|error| {
                MessageUsecaseError::dependency_unavailable(format!(
                    "message_update_failed:{error}"
                ))
            })?;
        let rows_result = query_result.into_rows_result().map_err(|error| {
            MessageUsecaseError::dependency_unavailable(format!(
                "message_update_rows_unavailable:{error}"
            ))
        })?;
        let row = rows_result.maybe_first_row::<Row>().map_err(|error| {
            MessageUsecaseError::dependency_unavailable(format!(
                "message_update_decode_failed:{error}"
            ))
        })?;

        Ok(match row {
            Some(row) => match Self::lwt_applied_from_row(row)? {
                true => MessageStoreUpdateResult::Applied,
                false => MessageStoreUpdateResult::Conflict,
            },
            None => MessageStoreUpdateResult::Conflict,
        })
    }
}

#[async_trait]
impl MessageBodyStore for ScyllaMessageStore {
    /// guild channel message を append する。
    /// @param message 保存対象 message snapshot
    /// @returns 保存済み message snapshot
    /// @throws MessageUsecaseError 依存障害時
    async fn append_guild_channel_message(
        &self,
        message: &MessageItemV1,
    ) -> Result<MessageItemV1, MessageUsecaseError> {
        let bucket = bucket_from_timestamp(&message.created_at)?;
        let created_at = parse_rfc3339_timestamp(&message.created_at)?;
        let edited_at = message
            .edited_at
            .as_deref()
            .map(parse_rfc3339_timestamp)
            .transpose()?;
        if let Err(error) = self
            .insert_message(message, bucket, created_at, edited_at, None, None)
            .await
        {
            if let Some(existing) = self
                .select_message(
                    message.guild_id,
                    message.channel_id,
                    bucket,
                    message.message_id,
                )
                .await?
            {
                return Ok(existing);
            }

            self.insert_message(message, bucket, created_at, edited_at, None, None)
                .await
                .map_err(|retry_error| {
                    MessageUsecaseError::dependency_unavailable(format!(
                        "message_append_failed:{error};retry:{retry_error}"
                    ))
                })?;
        }

        self.select_message(
            message.guild_id,
            message.channel_id,
            bucket,
            message.message_id,
        )
        .await?
        .ok_or_else(|| MessageUsecaseError::dependency_unavailable("message_append_select_missing"))
    }

    /// guild channel message を単一件取得する。
    /// @param context channel context
    /// @param message_id 対象 message_id
    /// @returns message snapshot。未存在時は `None`
    /// @throws MessageUsecaseError 依存障害時
    async fn get_guild_channel_message(
        &self,
        context: &GuildChannelContext,
        message_id: i64,
    ) -> Result<Option<MessageItemV1>, MessageUsecaseError> {
        self.select_message_across_buckets(context, message_id)
            .await
            .map(|value| value.map(|(_, message)| message))
    }

    /// guild channel message を条件付き更新する。
    /// @param message 更新後 message snapshot
    /// @param expected_version 競合検知に使う直前 version
    /// @param actor_id 更新主体
    /// @returns 更新結果
    /// @throws MessageUsecaseError 依存障害時
    async fn update_guild_channel_message(
        &self,
        message: &MessageItemV1,
        expected_version: i64,
        actor_id: i64,
    ) -> Result<MessageStoreUpdateResult, MessageUsecaseError> {
        let context = GuildChannelContext {
            channel_id: message.channel_id,
            guild_id: message.guild_id,
            created_at: message.created_at.clone(),
            last_message_id: Some(message.message_id),
            last_message_at: Some(message.created_at.clone()),
        };
        let Some((bucket, _)) = self
            .select_message_across_buckets(&context, message.message_id)
            .await?
        else {
            return Ok(MessageStoreUpdateResult::Conflict);
        };
        self.conditional_update_message(message, bucket, expected_version, actor_id)
            .await
    }

    /// guild channel message history を list する。
    /// @param context channel context
    /// @param query 正規化済み query
    /// @returns list response
    /// @throws MessageUsecaseError validation または依存障害時
    async fn list_guild_channel_messages(
        &self,
        context: &GuildChannelContext,
        query: &ListGuildChannelMessagesQueryV1,
    ) -> Result<ListGuildChannelMessagesResponseV1, MessageUsecaseError> {
        let limit = query.limit.unwrap_or(50) as usize;
        let collect_target = limit + 1;
        let lower_bucket = bucket_from_timestamp(&context.created_at)?;
        let upper_bucket = resolve_upper_bucket(context, OffsetDateTime::now_utc())?;
        let mut items = Vec::with_capacity(collect_target);
        let mut seen = HashSet::with_capacity(collect_target);

        if let Some(after) = query.after.as_deref() {
            let cursor = MessageCursorKeyV1::decode(after)?;
            let start_bucket = bucket_from_timestamp(&cursor.created_at)?;
            let mut bucket = start_bucket;
            while bucket <= upper_bucket && items.len() < collect_target {
                let remaining = collect_target - items.len();
                let bucket_items = if bucket == start_bucket {
                    self.query_bucket_after(
                        context.guild_id,
                        context.channel_id,
                        bucket,
                        &cursor,
                        remaining,
                    )
                    .await?
                } else {
                    self.query_bucket_asc(context.guild_id, context.channel_id, bucket, remaining)
                        .await?
                };
                collect_unique_items(&mut items, &mut seen, bucket_items, collect_target);
                bucket = next_bucket(bucket)?;
            }
            return Ok(build_page_response(items, limit, CursorDirection::After));
        }

        let cursor = query
            .before
            .as_deref()
            .map(MessageCursorKeyV1::decode)
            .transpose()?;
        let start_bucket = cursor
            .as_ref()
            .map(|value| bucket_from_timestamp(&value.created_at))
            .transpose()?
            .unwrap_or(upper_bucket);
        let mut bucket = start_bucket;
        while bucket >= lower_bucket && items.len() < collect_target {
            let remaining = collect_target - items.len();
            let bucket_items = match cursor.as_ref() {
                Some(value) if bucket == start_bucket => {
                    self.query_bucket_before(
                        context.guild_id,
                        context.channel_id,
                        bucket,
                        value,
                        remaining,
                    )
                    .await?
                }
                _ => {
                    self.query_bucket_desc(context.guild_id, context.channel_id, bucket, remaining)
                        .await?
                }
            };
            collect_unique_items(&mut items, &mut seen, bucket_items, collect_target);
            if bucket == lower_bucket {
                break;
            }
            bucket = previous_bucket(bucket)?;
        }

        Ok(build_page_response(items, limit, CursorDirection::Before))
    }
}

fn qualify_messages_by_channel_sql(template: &str, keyspace: &str) -> String {
    template.replace(
        "chat.messages_by_channel",
        &format!("{keyspace}.messages_by_channel"),
    )
}

fn validate_keyspace_identifier(keyspace: &str) -> Result<(), MessageUsecaseError> {
    let mut chars = keyspace.chars();
    let Some(first) = chars.next() else {
        return Err(MessageUsecaseError::dependency_unavailable(
            "message_keyspace_invalid",
        ));
    };

    if !first.is_ascii_alphabetic()
        || !chars.all(|value| value.is_ascii_alphanumeric() || value == '_')
    {
        return Err(MessageUsecaseError::dependency_unavailable(
            "message_keyspace_invalid",
        ));
    }

    Ok(())
}

fn collect_unique_items(
    items: &mut Vec<MessageItemV1>,
    seen: &mut HashSet<i64>,
    candidates: Vec<MessageItemV1>,
    collect_target: usize,
) {
    for candidate in candidates {
        if seen.insert(candidate.message_id) {
            items.push(candidate);
        }
        if items.len() >= collect_target {
            break;
        }
    }
}

fn resolve_upper_bucket(
    context: &GuildChannelContext,
    now: OffsetDateTime,
) -> Result<i32, MessageUsecaseError> {
    match context.last_message_at.as_deref() {
        Some(last_message_at) => bucket_from_timestamp(last_message_at),
        None => Ok(date_to_bucket(now.date())),
    }
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
    let cursor = items.last().map(|item| MessageCursorKeyV1 {
        created_at: item.created_at.clone(),
        message_id: item.message_id,
    });
    let next_before = matches!(direction, CursorDirection::Before)
        .then_some(cursor.as_ref().map(MessageCursorKeyV1::encode))
        .flatten()
        .filter(|_| has_more);
    let next_after = matches!(direction, CursorDirection::After)
        .then_some(cursor.as_ref().map(MessageCursorKeyV1::encode))
        .flatten()
        .filter(|_| has_more);

    ListGuildChannelMessagesResponseV1 {
        items,
        next_before,
        next_after,
        has_more,
    }
}

fn map_row_to_message(
    guild_id: i64,
    row: ScyllaMessageRow,
) -> Result<MessageItemV1, MessageUsecaseError> {
    let (
        channel_id,
        _bucket,
        message_id,
        author_id,
        content,
        version,
        edited_at,
        is_deleted,
        _deleted_at,
        _deleted_by,
        created_at,
    ) = row;

    Ok(MessageItemV1 {
        message_id,
        guild_id,
        channel_id,
        author_id,
        content,
        created_at: format_rfc3339_timestamp(created_at)?,
        version,
        edited_at: edited_at.map(format_rfc3339_timestamp).transpose()?,
        is_deleted,
    })
}

fn parse_rfc3339_timestamp(value: &str) -> Result<OffsetDateTime, MessageUsecaseError> {
    OffsetDateTime::parse(value, &Rfc3339).map_err(|error| {
        MessageUsecaseError::validation(format!("message_timestamp_invalid:{error}"))
    })
}

fn format_rfc3339_timestamp(value: CqlTimestamp) -> Result<String, MessageUsecaseError> {
    let timestamp = OffsetDateTime::from_unix_timestamp_nanos(value.0 as i128 * 1_000_000)
        .map_err(|error| {
            MessageUsecaseError::dependency_unavailable(format!(
                "message_timestamp_decode_failed:{error}"
            ))
        })?;
    timestamp.format(&Rfc3339).map_err(|error| {
        MessageUsecaseError::dependency_unavailable(format!(
            "message_timestamp_format_failed:{error}"
        ))
    })
}

fn timestamp_to_cql(value: OffsetDateTime) -> CqlTimestamp {
    CqlTimestamp(value.unix_timestamp() * 1000 + value.millisecond() as i64)
}

fn bucket_from_timestamp(value: &str) -> Result<i32, MessageUsecaseError> {
    Ok(date_to_bucket(parse_rfc3339_timestamp(value)?.date()))
}

fn previous_bucket(bucket: i32) -> Result<i32, MessageUsecaseError> {
    let previous = bucket_to_date(bucket)?
        .previous_day()
        .ok_or_else(|| MessageUsecaseError::validation("message_bucket_before_range"))?;
    Ok(date_to_bucket(previous))
}

fn next_bucket(bucket: i32) -> Result<i32, MessageUsecaseError> {
    let next = bucket_to_date(bucket)?
        .next_day()
        .ok_or_else(|| MessageUsecaseError::validation("message_bucket_after_range"))?;
    Ok(date_to_bucket(next))
}

fn bucket_to_date(bucket: i32) -> Result<Date, MessageUsecaseError> {
    let year = bucket / 10_000;
    let month = ((bucket / 100) % 100) as u8;
    let day = (bucket % 100) as u8;
    let month = Month::try_from(month).map_err(|error| {
        MessageUsecaseError::validation(format!("message_bucket_invalid_month:{error}"))
    })?;
    Date::from_calendar_date(year, month, day).map_err(|error| {
        MessageUsecaseError::validation(format!("message_bucket_invalid_date:{error}"))
    })
}

fn date_to_bucket(date: Date) -> i32 {
    date.year() * 10_000 + i32::from(u8::from(date.month())) * 100 + i32::from(date.day())
}

#[cfg(test)]
mod tests {
    use linklynx_message_api::MessageItemV1;
    use linklynx_message_domain::GuildChannelContext;
    use time::{format_description::well_known::Rfc3339, OffsetDateTime};

    use super::{
        bucket_from_timestamp, build_page_response, resolve_upper_bucket, CursorDirection,
    };

    fn sample_item(message_id: i64, created_at: &str) -> MessageItemV1 {
        MessageItemV1 {
            message_id,
            guild_id: 10,
            channel_id: 20,
            author_id: 30,
            content: "hello".to_owned(),
            created_at: created_at.to_owned(),
            version: 1,
            edited_at: None,
            is_deleted: false,
        }
    }

    #[test]
    fn bucket_from_timestamp_uses_utc_day() {
        assert_eq!(
            bucket_from_timestamp("2026-03-08T10:11:12Z").unwrap(),
            20260308
        );
    }

    #[test]
    fn build_page_response_sets_next_before_for_older_direction() {
        let response = build_page_response(
            vec![
                sample_item(120_110, "2026-03-08T10:00:03Z"),
                sample_item(120_109, "2026-03-08T10:00:02Z"),
            ],
            1,
            CursorDirection::Before,
        );

        assert_eq!(response.items.len(), 1);
        assert!(response.next_before.is_some());
        assert_eq!(response.next_after, None);
        assert!(response.has_more);
    }

    #[test]
    fn build_page_response_sets_next_after_for_newer_direction() {
        let response = build_page_response(
            vec![
                sample_item(120_109, "2026-03-08T10:00:02Z"),
                sample_item(120_110, "2026-03-08T10:00:03Z"),
            ],
            1,
            CursorDirection::After,
        );

        assert_eq!(response.items.len(), 1);
        assert_eq!(response.next_before, None);
        assert!(response.next_after.is_some());
        assert!(response.has_more);
    }

    #[test]
    fn resolve_upper_bucket_uses_last_message_at_when_present() {
        let context = GuildChannelContext {
            channel_id: 20,
            guild_id: 10,
            created_at: "2026-03-01T00:00:00Z".to_owned(),
            last_message_id: Some(120_111),
            last_message_at: Some("2026-03-07T10:00:00Z".to_owned()),
        };

        let now = OffsetDateTime::parse("2026-03-08T00:00:00Z", &Rfc3339).unwrap();
        let bucket = resolve_upper_bucket(&context, now).unwrap();

        assert_eq!(bucket, 20260307);
    }

    #[test]
    fn resolve_upper_bucket_falls_back_to_current_utc_day_when_metadata_is_missing() {
        let context = GuildChannelContext {
            channel_id: 20,
            guild_id: 10,
            created_at: "2026-03-01T00:00:00Z".to_owned(),
            last_message_id: None,
            last_message_at: None,
        };

        let now = OffsetDateTime::parse("2026-03-08T10:11:12Z", &Rfc3339).unwrap();
        let bucket = resolve_upper_bucket(&context, now).unwrap();

        assert_eq!(bucket, 20260308);
    }
}
