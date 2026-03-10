/// message API ユースケース境界を表現する。
#[async_trait]
pub trait MessageService: Send + Sync {
    /// guild channel message history を返す。
    /// @param guild_id 対象 guild_id
    /// @param channel_id 対象 channel_id
    /// @param query list query
    /// @returns list response
    /// @throws MessageError validation / not found / dependency unavailable 時
    async fn list_guild_channel_messages(
        &self,
        guild_id: i64,
        channel_id: i64,
        query: ListGuildChannelMessagesQueryV1,
    ) -> Result<ListGuildChannelMessagesResponseV1, MessageError>;

    /// guild channel message を作成する。
    /// @param principal_id 投稿主体
    /// @param guild_id 対象 guild_id
    /// @param channel_id 対象 channel_id
    /// @param idempotency_key caller supplied durable idempotency key
    /// @param request 作成入力
    /// @returns 作成レスポンスと publish 判定
    /// @throws MessageError validation / not found / dependency unavailable 時
    async fn create_guild_channel_message(
        &self,
        principal_id: PrincipalId,
        guild_id: i64,
        channel_id: i64,
        idempotency_key: Option<&str>,
        request: CreateGuildChannelMessageRequestV1,
    ) -> Result<CreateGuildChannelMessageExecution, MessageError>;

    /// DM message history を返す。
    /// @param channel_id 対象 channel_id
    /// @param query list query
    /// @returns list response
    /// @throws MessageError validation / not found / dependency unavailable 時
    async fn list_dm_channel_messages(
        &self,
        channel_id: i64,
        query: ListGuildChannelMessagesQueryV1,
    ) -> Result<ListGuildChannelMessagesResponseV1, MessageError>;

    /// DM message を作成する。
    /// @param principal_id 投稿主体
    /// @param channel_id 対象 channel_id
    /// @param idempotency_key caller supplied durable idempotency key
    /// @param request 作成入力
    /// @returns 作成レスポンスと publish 判定
    /// @throws MessageError validation / not found / dependency unavailable 時
    async fn create_dm_channel_message(
        &self,
        principal_id: PrincipalId,
        channel_id: i64,
        idempotency_key: Option<&str>,
        request: CreateGuildChannelMessageRequestV1,
    ) -> Result<CreateGuildChannelMessageExecution, MessageError>;
}

/// guild channel message create の service 実行結果を表現する。
#[derive(Debug, Clone)]
pub struct CreateGuildChannelMessageExecution {
    pub response: CreateGuildChannelMessageResponseV1,
    pub should_publish: bool,
}

/// 実行時 message service を表現する。
#[derive(Clone)]
pub struct RuntimeMessageService {
    usecase: Arc<dyn MessageUsecase>,
    next_message_id: Arc<AtomicI64>,
}

impl RuntimeMessageService {
    /// runtime service を生成する。
    /// @param usecase message usecase
    /// @returns runtime service
    /// @throws なし
    pub fn new(usecase: Arc<dyn MessageUsecase>) -> Self {
        Self {
            usecase,
            next_message_id: Arc::new(AtomicI64::new(0)),
        }
    }

    #[cfg(test)]
    fn new_for_test(usecase: Arc<dyn MessageUsecase>) -> Self {
        Self {
            usecase,
            next_message_id: Arc::new(AtomicI64::new(0)),
        }
    }

    fn allocate_message_identity(&self) -> Result<MessageIdentity, MessageError> {
        let now = OffsetDateTime::now_utc();
        self.allocate_message_identity_at(now)
    }

    #[cfg(test)]
    fn allocate_message_identity_at(
        &self,
        now: OffsetDateTime,
    ) -> Result<MessageIdentity, MessageError> {
        let created_at = now
            .replace_nanosecond(0)
            .map_err(|error| {
                MessageError::dependency_unavailable(format!(
                    "message_timestamp_generation_failed:{error}"
                ))
            })?;
        let created_at = created_at.format(&Rfc3339).map_err(|error| {
            MessageError::dependency_unavailable(format!(
                "message_timestamp_format_failed:{error}"
            ))
        })?;
        let message_id = self.allocate_message_id(now)?;

        Ok(MessageIdentity {
            message_id,
            created_at,
        })
    }

    #[cfg(not(test))]
    fn allocate_message_identity_at(
        &self,
        now: OffsetDateTime,
    ) -> Result<MessageIdentity, MessageError> {
        let created_at = now
            .replace_nanosecond(0)
            .map_err(|error| {
                MessageError::dependency_unavailable(format!(
                    "message_timestamp_generation_failed:{error}"
                ))
            })?;
        let created_at = created_at.format(&Rfc3339).map_err(|error| {
            MessageError::dependency_unavailable(format!(
                "message_timestamp_format_failed:{error}"
            ))
        })?;
        let message_id = self.allocate_message_id(now)?;

        Ok(MessageIdentity {
            message_id,
            created_at,
        })
    }

    fn build_idempotency(
        &self,
        key: Option<&str>,
        request: &CreateGuildChannelMessageRequestV1,
    ) -> Result<Option<MessageCreateIdempotency>, MessageError> {
        let Some(key) = key else {
            return Ok(None);
        };
        let payload = serde_json::to_vec(request).map_err(|error| {
            MessageError::dependency_unavailable(format!(
                "message_idempotency_payload_encode_failed:{error}"
            ))
        })?;
        let mut hasher = Sha256::new();
        hasher.update(payload);
        Ok(Some(MessageCreateIdempotency {
            key: key.to_owned(),
            payload_fingerprint: format!("{:x}", hasher.finalize()),
        }))
    }

    fn allocate_message_id(&self, now: OffsetDateTime) -> Result<i64, MessageError> {
        let candidate = i64::try_from(now.unix_timestamp_nanos()).map_err(|error| {
            MessageError::dependency_unavailable(format!("message_id_generation_failed:{error}"))
        })?;
        loop {
            let previous = self.next_message_id.load(Ordering::Relaxed);
            let next = candidate.max(previous.saturating_add(1));
            match self.next_message_id.compare_exchange(
                previous,
                next,
                Ordering::Relaxed,
                Ordering::Relaxed,
            ) {
                Ok(_) => return Ok(next),
                Err(_) => continue,
            }
        }
    }
}

#[async_trait]
impl MessageService for RuntimeMessageService {
    /// guild channel message history を返す。
    /// @param guild_id 対象 guild_id
    /// @param channel_id 対象 channel_id
    /// @param query list query
    /// @returns list response
    /// @throws MessageError validation / not found / dependency unavailable 時
    async fn list_guild_channel_messages(
        &self,
        guild_id: i64,
        channel_id: i64,
        query: ListGuildChannelMessagesQueryV1,
    ) -> Result<ListGuildChannelMessagesResponseV1, MessageError> {
        self.usecase
            .list_guild_channel_messages(guild_id, channel_id, query)
            .await
            .map_err(MessageError::from)
    }

    /// guild channel message を作成する。
    /// @param principal_id 投稿主体
    /// @param guild_id 対象 guild_id
    /// @param channel_id 対象 channel_id
    /// @param idempotency_key caller supplied durable idempotency key
    /// @param request 作成入力
    /// @returns 作成レスポンスと publish 判定
    /// @throws MessageError validation / not found / dependency unavailable 時
    async fn create_guild_channel_message(
        &self,
        principal_id: PrincipalId,
        guild_id: i64,
        channel_id: i64,
        idempotency_key: Option<&str>,
        request: CreateGuildChannelMessageRequestV1,
    ) -> Result<CreateGuildChannelMessageExecution, MessageError> {
        let identity = self.allocate_message_identity()?;
        let idempotency = self.build_idempotency(idempotency_key, &request)?;
        let result = self
            .usecase
            .create_guild_channel_message(CreateGuildChannelMessageCommand {
                guild_id,
                channel_id,
                author_id: principal_id.0,
                content: request.content,
                proposed_identity: identity,
                idempotency,
            })
            .await
            .map_err(MessageError::from)?;

        Ok(CreateGuildChannelMessageExecution {
            response: CreateGuildChannelMessageResponseV1 {
                message: result.message,
            },
            should_publish: result.should_publish,
        })
    }

    /// DM message history を返す。
    /// @param channel_id 対象 channel_id
    /// @param query list query
    /// @returns list response
    /// @throws MessageError validation / not found / dependency unavailable 時
    async fn list_dm_channel_messages(
        &self,
        channel_id: i64,
        query: ListGuildChannelMessagesQueryV1,
    ) -> Result<ListGuildChannelMessagesResponseV1, MessageError> {
        self.usecase
            .list_guild_channel_messages(channel_id, channel_id, query)
            .await
            .map_err(MessageError::from)
    }

    /// DM message を作成する。
    /// @param principal_id 投稿主体
    /// @param channel_id 対象 channel_id
    /// @param idempotency_key caller supplied durable idempotency key
    /// @param request 作成入力
    /// @returns 作成レスポンスと publish 判定
    /// @throws MessageError validation / not found / dependency unavailable 時
    async fn create_dm_channel_message(
        &self,
        principal_id: PrincipalId,
        channel_id: i64,
        idempotency_key: Option<&str>,
        request: CreateGuildChannelMessageRequestV1,
    ) -> Result<CreateGuildChannelMessageExecution, MessageError> {
        let identity = self.allocate_message_identity()?;
        let idempotency = self.build_idempotency(idempotency_key, &request)?;
        let result = self
            .usecase
            .create_guild_channel_message(CreateGuildChannelMessageCommand {
                guild_id: channel_id,
                channel_id,
                author_id: principal_id.0,
                content: request.content,
                proposed_identity: identity,
                idempotency,
            })
            .await
            .map_err(MessageError::from)?;

        Ok(CreateGuildChannelMessageExecution {
            response: CreateGuildChannelMessageResponseV1 {
                message: result.message,
            },
            should_publish: result.should_publish,
        })
    }
}

/// 依存未構成時に fail-close させる message service を表現する。
#[derive(Clone)]
pub struct UnavailableMessageService {
    reason: String,
}

impl UnavailableMessageService {
    /// unavailable service を生成する。
    /// @param reason unavailable 理由
    /// @returns unavailable service
    /// @throws なし
    pub fn new(reason: impl Into<String>) -> Self {
        Self {
            reason: reason.into(),
        }
    }

    fn unavailable_error(&self) -> MessageError {
        MessageError::dependency_unavailable(self.reason.clone())
    }
}

#[async_trait]
impl MessageService for UnavailableMessageService {
    /// guild channel message history を返す。
    /// @param _guild_id 対象 guild_id
    /// @param _channel_id 対象 channel_id
    /// @param _query list query
    /// @returns なし
    /// @throws MessageError 常に unavailable
    async fn list_guild_channel_messages(
        &self,
        _guild_id: i64,
        _channel_id: i64,
        _query: ListGuildChannelMessagesQueryV1,
    ) -> Result<ListGuildChannelMessagesResponseV1, MessageError> {
        Err(self.unavailable_error())
    }

    /// guild channel message を作成する。
    /// @param _principal_id 投稿主体
    /// @param _guild_id 対象 guild_id
    /// @param _channel_id 対象 channel_id
    /// @param _idempotency_key caller supplied durable idempotency key
    /// @param _request 作成入力
    /// @returns なし
    /// @throws MessageError 常に unavailable
    async fn create_guild_channel_message(
        &self,
        _principal_id: PrincipalId,
        _guild_id: i64,
        _channel_id: i64,
        _idempotency_key: Option<&str>,
        _request: CreateGuildChannelMessageRequestV1,
    ) -> Result<CreateGuildChannelMessageExecution, MessageError> {
        Err(self.unavailable_error())
    }

    /// DM message history を返す。
    /// @param _channel_id 対象 channel_id
    /// @param _query list query
    /// @returns なし
    /// @throws MessageError 常に unavailable
    async fn list_dm_channel_messages(
        &self,
        _channel_id: i64,
        _query: ListGuildChannelMessagesQueryV1,
    ) -> Result<ListGuildChannelMessagesResponseV1, MessageError> {
        Err(self.unavailable_error())
    }

    /// DM message を作成する。
    /// @param _principal_id 投稿主体
    /// @param _channel_id 対象 channel_id
    /// @param _idempotency_key caller supplied durable idempotency key
    /// @param _request 作成入力
    /// @returns なし
    /// @throws MessageError 常に unavailable
    async fn create_dm_channel_message(
        &self,
        _principal_id: PrincipalId,
        _channel_id: i64,
        _idempotency_key: Option<&str>,
        _request: CreateGuildChannelMessageRequestV1,
    ) -> Result<CreateGuildChannelMessageExecution, MessageError> {
        Err(self.unavailable_error())
    }
}

#[cfg(test)]
#[allow(clippy::items_after_test_module)]
mod tests {
    use super::*;
    use crate::message::test_support::{
        bucket_from_created_at, connect_integration_database, connect_integration_scylla,
        count_scylla_messages, build_live_usecase, insert_scylla_message,
        next_integration_id_block, query_last_message, seed_guild_text_channel, seed_user,
        upsert_channel_last_message, SeedMessageRow,
    };
    use linklynx_message_api::MessageCursorKeyV1;
    use linklynx_message_domain::MessageBodyStore;
    use std::collections::{HashMap, HashSet};
    use time::{format_description::well_known::Rfc3339, OffsetDateTime};
    use tokio::sync::Mutex;

    #[derive(Default)]
    struct RecordingMessageUsecase {
        created: Mutex<Vec<CreateGuildChannelMessageCommand>>,
    }

    #[async_trait]
    impl MessageUsecase for RecordingMessageUsecase {
        async fn create_guild_channel_message(
            &self,
            command: CreateGuildChannelMessageCommand,
        ) -> Result<linklynx_message_domain::CreateGuildChannelMessageResult, MessageUsecaseError> {
            self.created.lock().await.push(command.clone());
            Ok(linklynx_message_domain::CreateGuildChannelMessageResult {
                message: command.to_message_item(&command.proposed_identity),
                should_publish: true,
            })
        }

        async fn list_guild_channel_messages(
            &self,
            _guild_id: i64,
            _channel_id: i64,
            _query: ListGuildChannelMessagesQueryV1,
        ) -> Result<ListGuildChannelMessagesResponseV1, MessageUsecaseError> {
            Ok(ListGuildChannelMessagesResponseV1 {
                items: vec![],
                next_before: None,
                next_after: None,
                has_more: false,
            })
        }
    }

    #[derive(Default)]
    struct StableIdempotencyUsecase {
        entries: Mutex<HashMap<String, linklynx_message_api::MessageItemV1>>,
    }

    #[async_trait]
    impl MessageUsecase for StableIdempotencyUsecase {
        async fn create_guild_channel_message(
            &self,
            command: CreateGuildChannelMessageCommand,
        ) -> Result<linklynx_message_domain::CreateGuildChannelMessageResult, MessageUsecaseError> {
            let Some(idempotency) = command.idempotency.as_ref() else {
                return Ok(linklynx_message_domain::CreateGuildChannelMessageResult {
                    message: command.to_message_item(&command.proposed_identity),
                    should_publish: true,
                });
            };

            let mut entries = self.entries.lock().await;
            if let Some(existing) = entries.get(&idempotency.key) {
                if existing.content != command.content {
                    return Err(MessageUsecaseError::validation(
                        "message_idempotency_payload_mismatch",
                    ));
                }
                return Ok(linklynx_message_domain::CreateGuildChannelMessageResult {
                    message: existing.clone(),
                    should_publish: false,
                });
            }

            let message = command.to_message_item(&command.proposed_identity);
            entries.insert(idempotency.key.clone(), message.clone());
            Ok(linklynx_message_domain::CreateGuildChannelMessageResult {
                message,
                should_publish: true,
            })
        }

        async fn list_guild_channel_messages(
            &self,
            _guild_id: i64,
            _channel_id: i64,
            _query: ListGuildChannelMessagesQueryV1,
        ) -> Result<ListGuildChannelMessagesResponseV1, MessageUsecaseError> {
            Ok(ListGuildChannelMessagesResponseV1 {
                items: vec![],
                next_before: None,
                next_after: None,
                has_more: false,
            })
        }
    }

    #[tokio::test]
    async fn missing_idempotency_key_allocates_distinct_message_ids() {
        let usecase = Arc::new(RecordingMessageUsecase::default());
        let service = RuntimeMessageService::new_for_test(usecase.clone());

        let _ = service
            .create_guild_channel_message(
                PrincipalId(9003),
                10,
                20,
                None,
                CreateGuildChannelMessageRequestV1 {
                    content: "first".to_owned(),
                },
            )
            .await
            .unwrap();
        let _ = service
            .create_guild_channel_message(
                PrincipalId(9003),
                10,
                20,
                None,
                CreateGuildChannelMessageRequestV1 {
                    content: "second".to_owned(),
                },
            )
            .await
            .unwrap();

        let created = usecase.created.lock().await;
        assert_eq!(created.len(), 2);
        assert_ne!(
            created[0].proposed_identity.message_id,
            created[1].proposed_identity.message_id
        );
    }

    #[tokio::test]
    async fn same_idempotency_key_builds_stable_payload_fingerprint() {
        let usecase = Arc::new(RecordingMessageUsecase::default());
        let service = RuntimeMessageService::new_for_test(usecase.clone());

        let _ = service
            .create_guild_channel_message(
                PrincipalId(9003),
                10,
                20,
                Some("idem-1"),
                CreateGuildChannelMessageRequestV1 {
                    content: "first".to_owned(),
                },
            )
            .await
            .unwrap();
        let _ = service
            .create_guild_channel_message(
                PrincipalId(9003),
                10,
                20,
                Some("idem-1"),
                CreateGuildChannelMessageRequestV1 {
                    content: "first".to_owned(),
                },
            )
            .await
            .unwrap();

        let created = usecase.created.lock().await;
        assert_eq!(created.len(), 2);
        assert_eq!(
            created[0].idempotency.as_ref().unwrap().payload_fingerprint,
            created[1].idempotency.as_ref().unwrap().payload_fingerprint
        );
        assert_eq!(created[0].idempotency.as_ref().unwrap().key, "idem-1");
    }

    #[tokio::test]
    async fn same_idempotency_key_reuses_identity_across_service_instances() {
        let usecase = Arc::new(StableIdempotencyUsecase::default());
        let first_service = RuntimeMessageService::new_for_test(usecase.clone());
        let second_service = RuntimeMessageService::new_for_test(usecase);

        let first = first_service
            .create_guild_channel_message(
                PrincipalId(9003),
                10,
                20,
                Some("idem-1"),
                CreateGuildChannelMessageRequestV1 {
                    content: "first".to_owned(),
                },
            )
            .await
            .unwrap();
        let second = second_service
            .create_guild_channel_message(
                PrincipalId(9003),
                10,
                20,
                Some("idem-1"),
                CreateGuildChannelMessageRequestV1 {
                    content: "first".to_owned(),
                },
            )
            .await
            .unwrap();

        assert_eq!(first.response.message.message_id, second.response.message.message_id);
        assert_eq!(first.response.message.created_at, second.response.message.created_at);
        assert!(first.should_publish);
        assert!(!second.should_publish);
    }

    #[tokio::test]
    async fn message_scylla_integration_duplicate_append_returns_existing_row_without_duplicates() {
        let Some((store_session, keyspace)) = connect_integration_scylla().await else {
            return;
        };
        let Some((count_session, _)) = connect_integration_scylla().await else {
            return;
        };

        let base_id = next_integration_id_block(10);
        let channel_id = base_id;
        let message = linklynx_message_api::MessageItemV1 {
            message_id: base_id + 1,
            guild_id: 10,
            channel_id,
            author_id: base_id + 2,
            content: "duplicate-check".to_owned(),
            created_at: "2026-03-08T10:11:12Z".to_owned(),
            version: 1,
            edited_at: None,
            is_deleted: false,
        };
        let bucket = bucket_from_created_at(&message.created_at);
        let store =
            ScyllaMessageStore::new(store_session, keyspace.clone()).expect("valid scylla keyspace");

        let first = store
            .append_guild_channel_message(&message)
            .await
            .expect("first append should succeed");
        let second = store
            .append_guild_channel_message(&message)
            .await
            .expect("duplicate append should converge");

        assert_eq!(first.message_id, message.message_id);
        assert_eq!(second.message_id, message.message_id);
        assert_eq!(
            count_scylla_messages(&count_session, &keyspace, channel_id, bucket).await,
            1
        );
    }

    #[tokio::test]
    async fn message_scylla_integration_create_updates_last_message_metadata() {
        let Some((database_url, client)) = connect_integration_database().await else {
            return;
        };
        let Some((session, keyspace)) = connect_integration_scylla().await else {
            return;
        };

        let base_id = next_integration_id_block(20);
        let owner_id = base_id;
        let author_id = base_id + 1;
        let guild_id = base_id + 2;
        let channel_id = base_id + 3;

        seed_user(&client, owner_id, "message-owner").await;
        seed_user(&client, author_id, "message-author").await;
        seed_guild_text_channel(
            &client,
            guild_id,
            owner_id,
            channel_id,
            "2026-03-07T00:00:00Z",
        )
        .await;

        let usecase = build_live_usecase(database_url, session, keyspace);
        let stored = usecase
            .create_guild_channel_message(CreateGuildChannelMessageCommand {
                guild_id,
                channel_id,
                author_id,
                content: "hello live create".to_owned(),
                proposed_identity: MessageIdentity {
                    message_id: base_id + 4,
                    created_at: "2026-03-08T12:34:56Z".to_owned(),
                },
                idempotency: None,
            })
            .await
            .expect("live create should succeed");

        let (last_message_id, last_message_at) = query_last_message(&client, channel_id).await;
        assert_eq!(stored.message.message_id, base_id + 4);
        assert_eq!(last_message_id, stored.message.message_id);
        assert_eq!(last_message_at, "2026-03-08T12:34:56Z");
        assert!(stored.should_publish);
    }

    #[tokio::test]
    async fn message_scylla_integration_fails_close_when_postgres_is_unreachable() {
        let Some((session, keyspace)) = connect_integration_scylla().await else {
            return;
        };

        let usecase = build_live_usecase(
            "postgres://postgres:password@127.0.0.1:59999/linklynx".to_owned(),
            session,
            keyspace,
        );
        let error = usecase
            .list_guild_channel_messages(
                10,
                20,
                ListGuildChannelMessagesQueryV1 {
                    limit: Some(1),
                    before: None,
                    after: None,
                },
            )
            .await
            .expect_err("postgres outage should fail-close");

        assert!(
            matches!(
                error,
                MessageUsecaseError::DependencyUnavailable(ref reason)
                    if reason.starts_with("message_metadata_connect_failed:")
            ),
            "unexpected error: {error:?}"
        );
    }

    #[tokio::test]
    async fn message_scylla_integration_list_respects_bucket_boundaries_and_cursor_ordering() {
        let Some((database_url, client)) = connect_integration_database().await else {
            return;
        };
        let Some((session, keyspace)) = connect_integration_scylla().await else {
            return;
        };

        let base_id = next_integration_id_block(30);
        let owner_id = base_id;
        let guild_id = base_id + 1;
        let channel_id = base_id + 2;

        seed_user(&client, owner_id, "paging-owner").await;
        seed_guild_text_channel(
            &client,
            guild_id,
            owner_id,
            channel_id,
            "2026-03-07T00:00:00Z",
        )
        .await;
        upsert_channel_last_message(&client, channel_id, 130_205, "2026-03-08T10:00:06Z").await;

        for row in [
            SeedMessageRow {
                message_id: 130_205,
                author_id: owner_id,
                created_at: "2026-03-08T10:00:06Z",
            },
            SeedMessageRow {
                message_id: 130_203,
                author_id: owner_id,
                created_at: "2026-03-08T10:00:05Z",
            },
        ] {
            insert_scylla_message(
                &session,
                &keyspace,
                channel_id,
                bucket_from_created_at(row.created_at),
                row,
            )
            .await;
        }
        for row in [
            SeedMessageRow {
                message_id: 130_202,
                author_id: owner_id,
                created_at: "2026-03-07T09:00:05Z",
            },
            SeedMessageRow {
                message_id: 130_201,
                author_id: owner_id,
                created_at: "2026-03-07T09:00:05Z",
            },
            SeedMessageRow {
                message_id: 130_199,
                author_id: owner_id,
                created_at: "2026-03-07T09:00:04Z",
            },
            SeedMessageRow {
                message_id: 130_198,
                author_id: owner_id,
                created_at: "2026-03-07T09:00:02Z",
            },
        ] {
            insert_scylla_message(
                &session,
                &keyspace,
                channel_id,
                bucket_from_created_at(row.created_at),
                row,
            )
            .await;
        }

        let usecase = build_live_usecase(database_url, session, keyspace);
        let first_page = usecase
            .list_guild_channel_messages(
                guild_id,
                channel_id,
                ListGuildChannelMessagesQueryV1 {
                    limit: Some(3),
                    before: None,
                    after: None,
                },
            )
            .await
            .expect("first page should succeed");
        assert_eq!(
            first_page
                .items
                .iter()
                .map(|item| item.message_id)
                .collect::<Vec<_>>(),
            vec![130_205, 130_203, 130_202]
        );
        assert!(first_page.has_more);
        assert!(first_page.next_before.is_some());
        assert!(first_page.next_after.is_none());

        let second_page = usecase
            .list_guild_channel_messages(
                guild_id,
                channel_id,
                ListGuildChannelMessagesQueryV1 {
                    limit: Some(3),
                    before: first_page.next_before.clone(),
                    after: None,
                },
            )
            .await
            .expect("before page should succeed");
        assert_eq!(
            second_page
                .items
                .iter()
                .map(|item| item.message_id)
                .collect::<Vec<_>>(),
            vec![130_201, 130_199, 130_198]
        );
        assert!(!second_page.has_more);
        assert!(second_page.next_before.is_none());

        let after_cursor = MessageCursorKeyV1 {
            created_at: "2026-03-07T09:00:05Z".to_owned(),
            message_id: 130_201,
        }
        .encode();
        let newer_page = usecase
            .list_guild_channel_messages(
                guild_id,
                channel_id,
                ListGuildChannelMessagesQueryV1 {
                    limit: Some(3),
                    before: None,
                    after: Some(after_cursor),
                },
            )
            .await
            .expect("after page should succeed");
        assert_eq!(
            newer_page
                .items
                .iter()
                .map(|item| item.message_id)
                .collect::<Vec<_>>(),
            vec![130_202, 130_203, 130_205]
        );
        assert_eq!(
            newer_page.items.len(),
            newer_page
                .items
                .iter()
                .map(|item| item.message_id)
                .collect::<HashSet<_>>()
                .len()
        );
        assert!(!newer_page.has_more);
        assert!(newer_page.next_after.is_none());
    }

    #[test]
    fn allocate_message_id_remains_unique_when_timestamp_is_identical() {
        let service =
            RuntimeMessageService::new_for_test(Arc::new(RecordingMessageUsecase::default()));
        let now = OffsetDateTime::parse("2026-03-08T10:11:12.123456789Z", &Rfc3339).unwrap();
        let mut ids = HashSet::new();

        for _ in 0..1_500 {
            let identity = service.allocate_message_identity_at(now).unwrap();
            assert!(ids.insert(identity.message_id));
            assert_eq!(identity.created_at, "2026-03-08T10:11:12Z");
        }
    }
}
