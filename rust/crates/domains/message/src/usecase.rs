use std::sync::Arc;

use async_trait::async_trait;
use linklynx_message_api::{
    normalize_list_query, validate_create_request, ListGuildChannelMessagesQueryV1,
    ListGuildChannelMessagesResponseV1, MessageItemV1,
};

use crate::{
    CreateGuildChannelMessageCommand, GuildChannelContext, MessageBodyStore,
    MessageCreateIdempotencyRepository, MessageCreateReservationState, MessageCreateReserveResult,
    MessageIdentity, MessageMetadataRepository, MessageUsecaseError,
};

/// message append/list usecase 境界を表現する。
#[async_trait]
pub trait MessageUsecase: Send + Sync {
    /// guild channel message を create する。
    /// @param command create command
    /// @returns 保存済み message snapshot
    /// @throws MessageUsecaseError validation / not found / dependency unavailable 時
    async fn create_guild_channel_message(
        &self,
        command: CreateGuildChannelMessageCommand,
    ) -> Result<MessageItemV1, MessageUsecaseError>;

    /// guild channel message history を list する。
    /// @param guild_id 対象 guild_id
    /// @param channel_id 対象 channel_id
    /// @param query list query
    /// @returns list response
    /// @throws MessageUsecaseError validation / not found / dependency unavailable 時
    async fn list_guild_channel_messages(
        &self,
        guild_id: i64,
        channel_id: i64,
        query: ListGuildChannelMessagesQueryV1,
    ) -> Result<ListGuildChannelMessagesResponseV1, MessageUsecaseError>;
}

/// live message usecase を表現する。
#[derive(Clone)]
pub struct LiveMessageUsecase {
    body_store: Arc<dyn MessageBodyStore>,
    metadata_repository: Arc<dyn MessageMetadataRepository>,
    idempotency_repository: Arc<dyn MessageCreateIdempotencyRepository>,
}

impl LiveMessageUsecase {
    /// live usecase を生成する。
    /// @param body_store message body store
    /// @param metadata_repository message metadata repository
    /// @returns live usecase
    /// @throws なし
    pub fn new(
        body_store: Arc<dyn MessageBodyStore>,
        metadata_repository: Arc<dyn MessageMetadataRepository>,
        idempotency_repository: Arc<dyn MessageCreateIdempotencyRepository>,
    ) -> Self {
        Self {
            body_store,
            metadata_repository,
            idempotency_repository,
        }
    }

    /// guild/channel context を検証付きで取得する。
    /// @param guild_id 対象 guild_id
    /// @param channel_id 対象 channel_id
    /// @returns channel context
    /// @throws MessageUsecaseError channel 未存在または guild 不一致時
    async fn load_channel_context(
        &self,
        guild_id: i64,
        channel_id: i64,
    ) -> Result<GuildChannelContext, MessageUsecaseError> {
        let Some(context) = self
            .metadata_repository
            .get_guild_channel_context(channel_id)
            .await?
        else {
            return Err(MessageUsecaseError::channel_not_found(
                "message_channel_not_found",
            ));
        };
        if context.guild_id != guild_id {
            return Err(MessageUsecaseError::channel_not_found(
                "message_channel_not_found",
            ));
        }
        Ok(context)
    }

    async fn append_message(
        &self,
        channel_id: i64,
        identity: &MessageIdentity,
        command: &CreateGuildChannelMessageCommand,
    ) -> Result<MessageItemV1, MessageUsecaseError> {
        let message = command.to_message_item(identity);
        let stored_message = self
            .body_store
            .append_guild_channel_message(&message)
            .await?;
        self.metadata_repository
            .upsert_last_message(
                channel_id,
                stored_message.message_id,
                &stored_message.created_at,
            )
            .await?;
        Ok(stored_message)
    }
}

#[async_trait]
impl MessageUsecase for LiveMessageUsecase {
    /// guild channel message を create する。
    /// @param command create command
    /// @returns 保存済み message snapshot
    /// @throws MessageUsecaseError validation / not found / dependency unavailable 時
    async fn create_guild_channel_message(
        &self,
        command: CreateGuildChannelMessageCommand,
    ) -> Result<MessageItemV1, MessageUsecaseError> {
        validate_create_request(&command.to_create_request())?;
        let context = self
            .load_channel_context(command.guild_id, command.channel_id)
            .await?;
        let Some(idempotency) = command.idempotency.as_ref() else {
            return self
                .append_message(context.channel_id, &command.proposed_identity, &command)
                .await;
        };

        let reservation = self
            .idempotency_repository
            .reserve_guild_channel_message_create(
                command.author_id,
                context.channel_id,
                idempotency,
                &command.proposed_identity,
            )
            .await?;
        match reservation {
            MessageCreateReserveResult::PayloadMismatch => Err(MessageUsecaseError::validation(
                "message_idempotency_payload_mismatch",
            )),
            MessageCreateReserveResult::Reserved(reservation) => {
                if reservation.state == MessageCreateReservationState::Completed {
                    return Ok(command.to_message_item(&reservation.identity));
                }
                let stored_message = self
                    .append_message(context.channel_id, &reservation.identity, &command)
                    .await?;
                self.idempotency_repository
                    .mark_guild_channel_message_create_completed(
                        command.author_id,
                        context.channel_id,
                        &idempotency.key,
                    )
                    .await?;
                Ok(stored_message)
            }
        }
    }

    /// guild channel message history を list する。
    /// @param guild_id 対象 guild_id
    /// @param channel_id 対象 channel_id
    /// @param query list query
    /// @returns list response
    /// @throws MessageUsecaseError validation / not found / dependency unavailable 時
    async fn list_guild_channel_messages(
        &self,
        guild_id: i64,
        channel_id: i64,
        query: ListGuildChannelMessagesQueryV1,
    ) -> Result<ListGuildChannelMessagesResponseV1, MessageUsecaseError> {
        let normalized = normalize_list_query(&query)?;
        let context = self.load_channel_context(guild_id, channel_id).await?;
        self.body_store
            .list_guild_channel_messages(&context, &normalized)
            .await
    }
}

/// fail-close な unavailable message usecase を表現する。
#[derive(Clone)]
pub struct UnavailableMessageUsecase {
    reason: String,
}

impl UnavailableMessageUsecase {
    /// unavailable usecase を生成する。
    /// @param reason unavailable 理由
    /// @returns unavailable usecase
    /// @throws なし
    pub fn new(reason: impl Into<String>) -> Self {
        Self {
            reason: reason.into(),
        }
    }

    fn unavailable_error(&self) -> MessageUsecaseError {
        MessageUsecaseError::dependency_unavailable(self.reason.clone())
    }
}

#[async_trait]
impl MessageUsecase for UnavailableMessageUsecase {
    /// guild channel message を create する。
    /// @param _command create command
    /// @returns なし
    /// @throws MessageUsecaseError 常に unavailable
    async fn create_guild_channel_message(
        &self,
        _command: CreateGuildChannelMessageCommand,
    ) -> Result<MessageItemV1, MessageUsecaseError> {
        Err(self.unavailable_error())
    }

    /// guild channel message history を list する。
    /// @param _guild_id 対象 guild_id
    /// @param _channel_id 対象 channel_id
    /// @param _query list query
    /// @returns なし
    /// @throws MessageUsecaseError 常に unavailable
    async fn list_guild_channel_messages(
        &self,
        _guild_id: i64,
        _channel_id: i64,
        _query: ListGuildChannelMessagesQueryV1,
    ) -> Result<ListGuildChannelMessagesResponseV1, MessageUsecaseError> {
        Err(self.unavailable_error())
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use async_trait::async_trait;
    use linklynx_message_api::{
        ListGuildChannelMessagesQueryV1, ListGuildChannelMessagesResponseV1, MessageCursorKeyV1,
        MessageItemV1,
    };
    use tokio::sync::Mutex;

    use crate::{
        CreateGuildChannelMessageCommand, GuildChannelContext, MessageCreateIdempotency,
        MessageCreateIdempotencyRepository, MessageCreateReservation,
        MessageCreateReservationState, MessageCreateReserveResult, MessageIdentity, MessageUsecase,
    };

    use super::{
        LiveMessageUsecase, MessageBodyStore, MessageMetadataRepository, MessageUsecaseError,
    };

    #[derive(Default)]
    struct FakeBodyStore {
        appended: Mutex<Vec<MessageItemV1>>,
        listed_queries: Mutex<Vec<ListGuildChannelMessagesQueryV1>>,
        append_result: Mutex<Option<Result<MessageItemV1, MessageUsecaseError>>>,
        list_result: Mutex<Option<Result<ListGuildChannelMessagesResponseV1, MessageUsecaseError>>>,
    }

    #[async_trait]
    impl MessageBodyStore for FakeBodyStore {
        async fn append_guild_channel_message(
            &self,
            message: &MessageItemV1,
        ) -> Result<MessageItemV1, MessageUsecaseError> {
            self.appended.lock().await.push(message.clone());
            if let Some(result) = self.append_result.lock().await.take() {
                result
            } else {
                Ok(message.clone())
            }
        }

        async fn list_guild_channel_messages(
            &self,
            _context: &GuildChannelContext,
            query: &ListGuildChannelMessagesQueryV1,
        ) -> Result<ListGuildChannelMessagesResponseV1, MessageUsecaseError> {
            self.listed_queries.lock().await.push(query.clone());
            if let Some(result) = self.list_result.lock().await.take() {
                result
            } else {
                Ok(ListGuildChannelMessagesResponseV1 {
                    items: vec![],
                    next_before: None,
                    next_after: None,
                    has_more: false,
                })
            }
        }
    }

    struct FakeMetadataRepository {
        context: Option<GuildChannelContext>,
        upserts: Mutex<Vec<(i64, i64, String)>>,
    }

    #[async_trait]
    impl MessageMetadataRepository for FakeMetadataRepository {
        async fn get_guild_channel_context(
            &self,
            _channel_id: i64,
        ) -> Result<Option<GuildChannelContext>, MessageUsecaseError> {
            Ok(self.context.clone())
        }

        async fn upsert_last_message(
            &self,
            channel_id: i64,
            message_id: i64,
            created_at: &str,
        ) -> Result<(), MessageUsecaseError> {
            self.upserts
                .lock()
                .await
                .push((channel_id, message_id, created_at.to_owned()));
            Ok(())
        }
    }

    #[derive(Default)]
    struct FakeIdempotencyRepository {
        reserve_result: Mutex<Option<Result<MessageCreateReserveResult, MessageUsecaseError>>>,
        reservations: Mutex<Vec<(i64, i64, MessageCreateIdempotency, MessageIdentity)>>,
        completions: Mutex<Vec<(i64, i64, String)>>,
    }

    #[async_trait]
    impl MessageCreateIdempotencyRepository for FakeIdempotencyRepository {
        async fn reserve_guild_channel_message_create(
            &self,
            principal_id: i64,
            channel_id: i64,
            idempotency: &MessageCreateIdempotency,
            proposed_identity: &MessageIdentity,
        ) -> Result<MessageCreateReserveResult, MessageUsecaseError> {
            self.reservations.lock().await.push((
                principal_id,
                channel_id,
                idempotency.clone(),
                proposed_identity.clone(),
            ));
            if let Some(result) = self.reserve_result.lock().await.take() {
                result
            } else {
                Ok(MessageCreateReserveResult::Reserved(
                    MessageCreateReservation {
                        identity: proposed_identity.clone(),
                        state: MessageCreateReservationState::Reserved,
                    },
                ))
            }
        }

        async fn mark_guild_channel_message_create_completed(
            &self,
            principal_id: i64,
            channel_id: i64,
            idempotency_key: &str,
        ) -> Result<(), MessageUsecaseError> {
            self.completions.lock().await.push((
                principal_id,
                channel_id,
                idempotency_key.to_owned(),
            ));
            Ok(())
        }
    }

    fn command() -> CreateGuildChannelMessageCommand {
        CreateGuildChannelMessageCommand {
            guild_id: 10,
            channel_id: 20,
            author_id: 30,
            content: "hello".to_owned(),
            proposed_identity: MessageIdentity {
                message_id: 120_111,
                created_at: "2026-03-08T10:00:00Z".to_owned(),
            },
            idempotency: None,
        }
    }

    fn context() -> GuildChannelContext {
        GuildChannelContext {
            channel_id: 20,
            guild_id: 10,
            created_at: "2026-03-01T00:00:00Z".to_owned(),
            last_message_id: Some(120_110),
            last_message_at: Some("2026-03-07T10:00:00Z".to_owned()),
        }
    }

    #[tokio::test]
    async fn append_rejects_blank_content() {
        let usecase = LiveMessageUsecase::new(
            Arc::new(FakeBodyStore::default()),
            Arc::new(FakeMetadataRepository {
                context: Some(context()),
                upserts: Mutex::new(vec![]),
            }),
            Arc::new(FakeIdempotencyRepository::default()),
        );

        let error = usecase
            .create_guild_channel_message(CreateGuildChannelMessageCommand {
                content: "   ".to_owned(),
                ..command()
            })
            .await
            .unwrap_err();

        assert_eq!(
            error,
            MessageUsecaseError::validation("message_content_required")
        );
    }

    #[tokio::test]
    async fn append_updates_metadata_after_store() {
        let body_store = Arc::new(FakeBodyStore::default());
        let metadata = Arc::new(FakeMetadataRepository {
            context: Some(context()),
            upserts: Mutex::new(vec![]),
        });
        let idempotency = Arc::new(FakeIdempotencyRepository::default());
        let usecase =
            LiveMessageUsecase::new(body_store.clone(), metadata.clone(), idempotency.clone());

        let stored = usecase
            .create_guild_channel_message(command())
            .await
            .unwrap();

        assert_eq!(stored.message_id, 120_111);
        assert_eq!(body_store.appended.lock().await.len(), 1);
        assert_eq!(
            metadata.upserts.lock().await.as_slice(),
            &[(20, 120_111, "2026-03-08T10:00:00Z".to_owned())]
        );
        assert!(idempotency.completions.lock().await.is_empty());
    }

    #[tokio::test]
    async fn create_returns_not_found_when_channel_is_missing() {
        let usecase = LiveMessageUsecase::new(
            Arc::new(FakeBodyStore::default()),
            Arc::new(FakeMetadataRepository {
                context: None,
                upserts: Mutex::new(vec![]),
            }),
            Arc::new(FakeIdempotencyRepository::default()),
        );

        let error = usecase
            .create_guild_channel_message(command())
            .await
            .unwrap_err();

        assert_eq!(
            error,
            MessageUsecaseError::channel_not_found("message_channel_not_found")
        );
    }

    #[tokio::test]
    async fn list_normalizes_query_before_store() {
        let body_store = Arc::new(FakeBodyStore::default());
        let usecase = LiveMessageUsecase::new(
            body_store.clone(),
            Arc::new(FakeMetadataRepository {
                context: Some(context()),
                upserts: Mutex::new(vec![]),
            }),
            Arc::new(FakeIdempotencyRepository::default()),
        );

        let _ = usecase
            .list_guild_channel_messages(10, 20, ListGuildChannelMessagesQueryV1::default())
            .await
            .unwrap();

        let listed_queries = body_store.listed_queries.lock().await;
        assert_eq!(listed_queries.len(), 1);
        assert_eq!(listed_queries[0].limit, Some(50));
    }

    #[tokio::test]
    async fn list_returns_not_found_when_guild_mismatch() {
        let usecase = LiveMessageUsecase::new(
            Arc::new(FakeBodyStore::default()),
            Arc::new(FakeMetadataRepository {
                context: Some(GuildChannelContext {
                    guild_id: 11,
                    ..context()
                }),
                upserts: Mutex::new(vec![]),
            }),
            Arc::new(FakeIdempotencyRepository::default()),
        );

        let error = usecase
            .list_guild_channel_messages(
                10,
                20,
                ListGuildChannelMessagesQueryV1 {
                    limit: Some(1),
                    before: Some(
                        MessageCursorKeyV1 {
                            created_at: "2026-03-07T10:00:00Z".to_owned(),
                            message_id: 120_110,
                        }
                        .encode(),
                    ),
                    after: None,
                },
            )
            .await
            .unwrap_err();

        assert_eq!(
            error,
            MessageUsecaseError::channel_not_found("message_channel_not_found")
        );
    }

    #[tokio::test]
    async fn create_rejects_payload_mismatch_when_idempotency_key_reused() {
        let idempotency = Arc::new(FakeIdempotencyRepository {
            reserve_result: Mutex::new(Some(Ok(MessageCreateReserveResult::PayloadMismatch))),
            ..FakeIdempotencyRepository::default()
        });
        let usecase = LiveMessageUsecase::new(
            Arc::new(FakeBodyStore::default()),
            Arc::new(FakeMetadataRepository {
                context: Some(context()),
                upserts: Mutex::new(vec![]),
            }),
            idempotency,
        );

        let error = usecase
            .create_guild_channel_message(CreateGuildChannelMessageCommand {
                idempotency: Some(MessageCreateIdempotency {
                    key: "same-key".to_owned(),
                    payload_fingerprint: "abc".to_owned(),
                }),
                ..command()
            })
            .await
            .unwrap_err();

        assert_eq!(
            error,
            MessageUsecaseError::validation("message_idempotency_payload_mismatch")
        );
    }

    #[tokio::test]
    async fn create_retries_append_for_reserved_idempotency_key() {
        let body_store = Arc::new(FakeBodyStore::default());
        let idempotency = Arc::new(FakeIdempotencyRepository {
            reserve_result: Mutex::new(Some(Ok(MessageCreateReserveResult::Reserved(
                MessageCreateReservation {
                    identity: MessageIdentity {
                        message_id: 120_222,
                        created_at: "2026-03-08T11:00:00Z".to_owned(),
                    },
                    state: MessageCreateReservationState::Reserved,
                },
            )))),
            ..FakeIdempotencyRepository::default()
        });
        let metadata = Arc::new(FakeMetadataRepository {
            context: Some(context()),
            upserts: Mutex::new(vec![]),
        });
        let usecase =
            LiveMessageUsecase::new(body_store.clone(), metadata.clone(), idempotency.clone());

        let stored = usecase
            .create_guild_channel_message(CreateGuildChannelMessageCommand {
                idempotency: Some(MessageCreateIdempotency {
                    key: "retry-key".to_owned(),
                    payload_fingerprint: "abc".to_owned(),
                }),
                ..command()
            })
            .await
            .unwrap();

        assert_eq!(stored.message_id, 120_222);
        assert_eq!(stored.created_at, "2026-03-08T11:00:00Z");
        assert_eq!(
            metadata.upserts.lock().await.as_slice(),
            &[(20, 120_222, "2026-03-08T11:00:00Z".to_owned())]
        );
        assert_eq!(
            idempotency.completions.lock().await.as_slice(),
            &[(30, 20, "retry-key".to_owned())]
        );
        assert_eq!(body_store.appended.lock().await[0].message_id, 120_222);
    }

    #[tokio::test]
    async fn create_reuses_completed_idempotency_key_without_append() {
        let body_store = Arc::new(FakeBodyStore::default());
        let idempotency = Arc::new(FakeIdempotencyRepository {
            reserve_result: Mutex::new(Some(Ok(MessageCreateReserveResult::Reserved(
                MessageCreateReservation {
                    identity: MessageIdentity {
                        message_id: 120_333,
                        created_at: "2026-03-08T12:00:00Z".to_owned(),
                    },
                    state: MessageCreateReservationState::Completed,
                },
            )))),
            ..FakeIdempotencyRepository::default()
        });
        let usecase = LiveMessageUsecase::new(
            body_store.clone(),
            Arc::new(FakeMetadataRepository {
                context: Some(context()),
                upserts: Mutex::new(vec![]),
            }),
            idempotency.clone(),
        );

        let stored = usecase
            .create_guild_channel_message(CreateGuildChannelMessageCommand {
                idempotency: Some(MessageCreateIdempotency {
                    key: "done-key".to_owned(),
                    payload_fingerprint: "abc".to_owned(),
                }),
                ..command()
            })
            .await
            .unwrap();

        assert_eq!(stored.message_id, 120_333);
        assert!(body_store.appended.lock().await.is_empty());
        assert!(idempotency.completions.lock().await.is_empty());
    }
}
