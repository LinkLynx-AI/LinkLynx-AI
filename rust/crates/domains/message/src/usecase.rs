use std::sync::Arc;

use async_trait::async_trait;
use linklynx_message_api::{
    normalize_list_query, validate_create_request, ListGuildChannelMessagesQueryV1,
    ListGuildChannelMessagesResponseV1, MessageItemV1,
};

use crate::{
    AppendGuildChannelMessageCommand, GuildChannelContext, MessageBodyStore,
    MessageMetadataRepository, MessageUsecaseError,
};

/// message append/list usecase 境界を表現する。
#[async_trait]
pub trait MessageUsecase: Send + Sync {
    /// guild channel message を append する。
    /// @param command append command
    /// @returns 保存済み message snapshot
    /// @throws MessageUsecaseError validation / not found / dependency unavailable 時
    async fn append_guild_channel_message(
        &self,
        command: AppendGuildChannelMessageCommand,
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
    ) -> Self {
        Self {
            body_store,
            metadata_repository,
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
}

#[async_trait]
impl MessageUsecase for LiveMessageUsecase {
    /// guild channel message を append する。
    /// @param command append command
    /// @returns 保存済み message snapshot
    /// @throws MessageUsecaseError validation / not found / dependency unavailable 時
    async fn append_guild_channel_message(
        &self,
        command: AppendGuildChannelMessageCommand,
    ) -> Result<MessageItemV1, MessageUsecaseError> {
        validate_create_request(&command.to_create_request())?;
        let context = self
            .load_channel_context(command.guild_id, command.channel_id)
            .await?;
        let message = command.to_message_item();
        let stored_message = self
            .body_store
            .append_guild_channel_message(&message)
            .await?;
        self.metadata_repository
            .upsert_last_message(
                context.channel_id,
                stored_message.message_id,
                &stored_message.created_at,
            )
            .await?;
        Ok(stored_message)
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
    /// guild channel message を append する。
    /// @param _command append command
    /// @returns なし
    /// @throws MessageUsecaseError 常に unavailable
    async fn append_guild_channel_message(
        &self,
        _command: AppendGuildChannelMessageCommand,
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

    use crate::{AppendGuildChannelMessageCommand, GuildChannelContext, MessageUsecase};

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

    fn command() -> AppendGuildChannelMessageCommand {
        AppendGuildChannelMessageCommand {
            guild_id: 10,
            channel_id: 20,
            author_id: 30,
            message_id: 120_111,
            content: "hello".to_owned(),
            created_at: "2026-03-08T10:00:00Z".to_owned(),
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
        );

        let error = usecase
            .append_guild_channel_message(AppendGuildChannelMessageCommand {
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
        let usecase = LiveMessageUsecase::new(body_store.clone(), metadata.clone());

        let stored = usecase
            .append_guild_channel_message(command())
            .await
            .unwrap();

        assert_eq!(stored.message_id, 120_111);
        assert_eq!(body_store.appended.lock().await.len(), 1);
        assert_eq!(
            metadata.upserts.lock().await.as_slice(),
            &[(20, 120_111, "2026-03-08T10:00:00Z".to_owned())]
        );
    }

    #[tokio::test]
    async fn append_returns_not_found_when_channel_is_missing() {
        let usecase = LiveMessageUsecase::new(
            Arc::new(FakeBodyStore::default()),
            Arc::new(FakeMetadataRepository {
                context: None,
                upserts: Mutex::new(vec![]),
            }),
        );

        let error = usecase
            .append_guild_channel_message(command())
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
}
