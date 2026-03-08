use std::sync::Arc;

use async_trait::async_trait;
use linklynx_message_api::{
    normalize_list_query, validate_create_request, CreateGuildChannelMessageRequestV1,
    CreateGuildChannelMessageResponseV1, ListGuildChannelMessagesQueryV1,
    ListGuildChannelMessagesResponseV1, MessageApiError, MessageItemV1,
};
use linklynx_shared::PrincipalId;
use thiserror::Error;

/// message domain の失敗種別を表現する。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MessageDomainErrorKind {
    Validation,
    ChannelNotFound,
    Forbidden,
    DependencyUnavailable,
}

/// message domain の失敗情報を表現する。
#[derive(Debug, Clone, Error)]
#[error("{reason}")]
pub struct MessageDomainError {
    pub kind: MessageDomainErrorKind,
    pub reason: String,
}

impl MessageDomainError {
    /// validation エラーを生成する。
    /// @param reason 失敗理由
    /// @returns validation エラー
    /// @throws なし
    pub fn validation(reason: impl Into<String>) -> Self {
        Self {
            kind: MessageDomainErrorKind::Validation,
            reason: reason.into(),
        }
    }

    /// channel 未存在エラーを生成する。
    /// @param reason 失敗理由
    /// @returns channel 未存在エラー
    /// @throws なし
    pub fn channel_not_found(reason: impl Into<String>) -> Self {
        Self {
            kind: MessageDomainErrorKind::ChannelNotFound,
            reason: reason.into(),
        }
    }

    /// 権限拒否エラーを生成する。
    /// @param reason 失敗理由
    /// @returns 権限拒否エラー
    /// @throws なし
    pub fn forbidden(reason: impl Into<String>) -> Self {
        Self {
            kind: MessageDomainErrorKind::Forbidden,
            reason: reason.into(),
        }
    }

    /// 依存障害エラーを生成する。
    /// @param reason 失敗理由
    /// @returns 依存障害エラー
    /// @throws なし
    pub fn dependency_unavailable(reason: impl Into<String>) -> Self {
        Self {
            kind: MessageDomainErrorKind::DependencyUnavailable,
            reason: reason.into(),
        }
    }
}

impl From<MessageApiError> for MessageDomainError {
    fn from(value: MessageApiError) -> Self {
        Self::validation(value.reason_code())
    }
}

/// message list 実行入力を表現する。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ListGuildChannelMessagesCommand {
    pub principal_id: PrincipalId,
    pub guild_id: i64,
    pub channel_id: i64,
    pub query: ListGuildChannelMessagesQueryV1,
}

/// message create 実行入力を表現する。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CreateGuildChannelMessageCommand {
    pub principal_id: PrincipalId,
    pub guild_id: i64,
    pub channel_id: i64,
    pub request: CreateGuildChannelMessageRequestV1,
}

/// message append 用の作成下書きを表現する。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MessageCreateDraft {
    pub guild_id: i64,
    pub channel_id: i64,
    pub author_id: i64,
    pub message_id: i64,
    pub content: String,
    pub created_at: String,
}

/// message SoR 境界を表現する。
#[async_trait]
pub trait MessageBodyRepository: Send + Sync {
    /// guild text channel の履歴を返す。
    /// @param guild_id 所属 guild_id
    /// @param channel_id 対象 channel_id
    /// @param query 正規化済み query
    /// @returns 履歴ページ
    /// @throws MessageDomainError 依存障害時
    async fn list_guild_channel_messages(
        &self,
        guild_id: i64,
        channel_id: i64,
        query: &ListGuildChannelMessagesQueryV1,
    ) -> Result<ListGuildChannelMessagesResponseV1, MessageDomainError>;

    /// guild text channel へ message を append する。
    /// @param draft 作成下書き
    /// @returns 作成済み message snapshot
    /// @throws MessageDomainError 依存障害時
    async fn append_guild_channel_message(
        &self,
        draft: MessageCreateDraft,
    ) -> Result<MessageItemV1, MessageDomainError>;
}

/// message metadata 境界を表現する。
#[async_trait]
pub trait MessageMetadataRepository: Send + Sync {
    /// principal が対象 channel を閲覧できるか確認する。
    /// @param principal_id principal_id
    /// @param guild_id 対象 guild_id
    /// @param channel_id 対象 channel_id
    /// @returns 成功時は `()`
    /// @throws MessageDomainError 未存在/境界違反/依存障害時
    async fn ensure_can_list_guild_channel_messages(
        &self,
        principal_id: PrincipalId,
        guild_id: i64,
        channel_id: i64,
    ) -> Result<(), MessageDomainError>;

    /// principal が対象 channel へ投稿できるか確認する。
    /// @param principal_id principal_id
    /// @param guild_id 対象 guild_id
    /// @param channel_id 対象 channel_id
    /// @returns 成功時は `()`
    /// @throws MessageDomainError 未存在/境界違反/依存障害時
    async fn ensure_can_create_guild_channel_message(
        &self,
        principal_id: PrincipalId,
        guild_id: i64,
        channel_id: i64,
    ) -> Result<(), MessageDomainError>;

    /// append 後の message metadata を更新する。
    /// @param message 作成済み message snapshot
    /// @returns 成功時は `()`
    /// @throws MessageDomainError 依存障害時
    async fn record_guild_channel_message_created(
        &self,
        message: &MessageItemV1,
    ) -> Result<(), MessageDomainError>;
}

/// message 作成時刻供給境界を表現する。
pub trait MessageClock: Send + Sync {
    /// 現在時刻を message created_at 形式で返す。
    /// @param なし
    /// @returns `YYYY-MM-DDTHH:MM:SSZ`
    /// @throws なし
    fn now_created_at(&self) -> String;
}

/// message id 採番境界を表現する。
pub trait MessageIdGenerator: Send + Sync {
    /// 新しい message_id を返す。
    /// @param created_at 作成時刻
    /// @returns message_id
    /// @throws なし
    fn next_message_id(&self, created_at: &str) -> i64;
}

/// transport から利用する message usecase を表現する。
#[async_trait]
pub trait MessageService: Send + Sync {
    /// guild text channel の履歴を返す。
    /// @param command 実行入力
    /// @returns 履歴ページ
    /// @throws MessageDomainError validation/境界違反/依存障害時
    async fn list_guild_channel_messages(
        &self,
        command: ListGuildChannelMessagesCommand,
    ) -> Result<ListGuildChannelMessagesResponseV1, MessageDomainError>;

    /// guild text channel へ message を作成する。
    /// @param command 実行入力
    /// @returns 作成結果
    /// @throws MessageDomainError validation/境界違反/依存障害時
    async fn create_guild_channel_message(
        &self,
        command: CreateGuildChannelMessageCommand,
    ) -> Result<CreateGuildChannelMessageResponseV1, MessageDomainError>;
}

/// default message usecase 実装を表現する。
pub struct DefaultMessageService {
    body_repository: Arc<dyn MessageBodyRepository>,
    metadata_repository: Arc<dyn MessageMetadataRepository>,
    clock: Arc<dyn MessageClock>,
    id_generator: Arc<dyn MessageIdGenerator>,
}

impl DefaultMessageService {
    /// default message usecase を生成する。
    /// @param body_repository message body repository
    /// @param metadata_repository message metadata repository
    /// @param clock message clock
    /// @param id_generator message id generator
    /// @returns default message usecase
    /// @throws なし
    pub fn new(
        body_repository: Arc<dyn MessageBodyRepository>,
        metadata_repository: Arc<dyn MessageMetadataRepository>,
        clock: Arc<dyn MessageClock>,
        id_generator: Arc<dyn MessageIdGenerator>,
    ) -> Self {
        Self {
            body_repository,
            metadata_repository,
            clock,
            id_generator,
        }
    }
}

#[async_trait]
impl MessageService for DefaultMessageService {
    async fn list_guild_channel_messages(
        &self,
        command: ListGuildChannelMessagesCommand,
    ) -> Result<ListGuildChannelMessagesResponseV1, MessageDomainError> {
        let normalized = normalize_list_query(&command.query)?;
        self.metadata_repository
            .ensure_can_list_guild_channel_messages(
                command.principal_id,
                command.guild_id,
                command.channel_id,
            )
            .await?;
        self.body_repository
            .list_guild_channel_messages(command.guild_id, command.channel_id, &normalized)
            .await
    }

    async fn create_guild_channel_message(
        &self,
        command: CreateGuildChannelMessageCommand,
    ) -> Result<CreateGuildChannelMessageResponseV1, MessageDomainError> {
        validate_create_request(&command.request)?;
        self.metadata_repository
            .ensure_can_create_guild_channel_message(
                command.principal_id,
                command.guild_id,
                command.channel_id,
            )
            .await?;

        let created_at = self.clock.now_created_at();
        let message_id = self.id_generator.next_message_id(&created_at);
        let message = self
            .body_repository
            .append_guild_channel_message(MessageCreateDraft {
                guild_id: command.guild_id,
                channel_id: command.channel_id,
                author_id: command.principal_id.0,
                message_id,
                content: command.request.content,
                created_at,
            })
            .await?;

        if let Err(error) = self
            .metadata_repository
            .record_guild_channel_message_created(&message)
            .await
        {
            if error.kind != MessageDomainErrorKind::DependencyUnavailable {
                return Err(error);
            }
        }

        Ok(CreateGuildChannelMessageResponseV1 { message })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    #[derive(Default)]
    struct FakeBodyRepository {
        list_response: Option<ListGuildChannelMessagesResponseV1>,
        append_response: Option<MessageItemV1>,
        appended: Mutex<Vec<MessageCreateDraft>>,
    }

    #[async_trait]
    impl MessageBodyRepository for FakeBodyRepository {
        async fn list_guild_channel_messages(
            &self,
            _guild_id: i64,
            _channel_id: i64,
            _query: &ListGuildChannelMessagesQueryV1,
        ) -> Result<ListGuildChannelMessagesResponseV1, MessageDomainError> {
            Ok(self
                .list_response
                .clone()
                .expect("list response must exist"))
        }

        async fn append_guild_channel_message(
            &self,
            draft: MessageCreateDraft,
        ) -> Result<MessageItemV1, MessageDomainError> {
            self.appended.lock().unwrap().push(draft);
            Ok(self
                .append_response
                .clone()
                .expect("append response must exist"))
        }
    }

    #[derive(Default)]
    struct FakeMetadataRepository {
        list_calls: Mutex<Vec<(PrincipalId, i64, i64)>>,
        create_calls: Mutex<Vec<(PrincipalId, i64, i64)>>,
        recorded_message_ids: Mutex<Vec<i64>>,
        record_error: Mutex<Option<MessageDomainError>>,
    }

    #[async_trait]
    impl MessageMetadataRepository for FakeMetadataRepository {
        async fn ensure_can_list_guild_channel_messages(
            &self,
            principal_id: PrincipalId,
            guild_id: i64,
            channel_id: i64,
        ) -> Result<(), MessageDomainError> {
            self.list_calls
                .lock()
                .unwrap()
                .push((principal_id, guild_id, channel_id));
            Ok(())
        }

        async fn ensure_can_create_guild_channel_message(
            &self,
            principal_id: PrincipalId,
            guild_id: i64,
            channel_id: i64,
        ) -> Result<(), MessageDomainError> {
            self.create_calls
                .lock()
                .unwrap()
                .push((principal_id, guild_id, channel_id));
            Ok(())
        }

        async fn record_guild_channel_message_created(
            &self,
            message: &MessageItemV1,
        ) -> Result<(), MessageDomainError> {
            if let Some(error) = self.record_error.lock().unwrap().take() {
                return Err(error);
            }
            self.recorded_message_ids
                .lock()
                .unwrap()
                .push(message.message_id);
            Ok(())
        }
    }

    struct StaticClock;

    impl MessageClock for StaticClock {
        fn now_created_at(&self) -> String {
            "2026-03-08T09:00:00Z".to_owned()
        }
    }

    struct StaticIdGenerator;

    impl MessageIdGenerator for StaticIdGenerator {
        fn next_message_id(&self, _created_at: &str) -> i64 {
            123_456
        }
    }

    fn sample_message() -> MessageItemV1 {
        MessageItemV1 {
            message_id: 123_456,
            guild_id: 10,
            channel_id: 20,
            author_id: 1001,
            content: "hello".to_owned(),
            created_at: "2026-03-08T09:00:00Z".to_owned(),
            version: 1,
            edited_at: None,
            is_deleted: false,
        }
    }

    #[tokio::test]
    async fn list_guild_channel_messages_normalizes_query_and_checks_access() {
        let body = Arc::new(FakeBodyRepository {
            list_response: Some(ListGuildChannelMessagesResponseV1 {
                items: vec![sample_message()],
                next_before: None,
                next_after: None,
                has_more: false,
            }),
            ..Default::default()
        });
        let metadata = Arc::new(FakeMetadataRepository::default());
        let service = DefaultMessageService::new(
            body,
            Arc::clone(&metadata) as Arc<dyn MessageMetadataRepository>,
            Arc::new(StaticClock),
            Arc::new(StaticIdGenerator),
        );

        let response = service
            .list_guild_channel_messages(ListGuildChannelMessagesCommand {
                principal_id: PrincipalId(1001),
                guild_id: 10,
                channel_id: 20,
                query: ListGuildChannelMessagesQueryV1 {
                    limit: None,
                    before: None,
                    after: None,
                },
            })
            .await
            .unwrap();

        assert_eq!(response.items.len(), 1);
        assert_eq!(
            metadata.list_calls.lock().unwrap().clone(),
            vec![(PrincipalId(1001), 10, 20)]
        );
    }

    #[tokio::test]
    async fn create_guild_channel_message_validates_and_records_metadata() {
        let body = Arc::new(FakeBodyRepository {
            append_response: Some(sample_message()),
            ..Default::default()
        });
        let metadata = Arc::new(FakeMetadataRepository::default());
        let service = DefaultMessageService::new(
            Arc::clone(&body) as Arc<dyn MessageBodyRepository>,
            Arc::clone(&metadata) as Arc<dyn MessageMetadataRepository>,
            Arc::new(StaticClock),
            Arc::new(StaticIdGenerator),
        );

        let response = service
            .create_guild_channel_message(CreateGuildChannelMessageCommand {
                principal_id: PrincipalId(1001),
                guild_id: 10,
                channel_id: 20,
                request: CreateGuildChannelMessageRequestV1 {
                    content: "hello".to_owned(),
                },
            })
            .await
            .unwrap();

        assert_eq!(response.message.message_id, 123_456);
        assert_eq!(metadata.create_calls.lock().unwrap().clone().len(), 1);
        assert_eq!(
            metadata.recorded_message_ids.lock().unwrap().clone(),
            vec![123_456]
        );
        assert_eq!(body.appended.lock().unwrap()[0].message_id, 123_456);
    }

    #[tokio::test]
    async fn create_guild_channel_message_rejects_blank_content() {
        let service = DefaultMessageService::new(
            Arc::new(FakeBodyRepository::default()),
            Arc::new(FakeMetadataRepository::default()),
            Arc::new(StaticClock),
            Arc::new(StaticIdGenerator),
        );

        let error = service
            .create_guild_channel_message(CreateGuildChannelMessageCommand {
                principal_id: PrincipalId(1001),
                guild_id: 10,
                channel_id: 20,
                request: CreateGuildChannelMessageRequestV1 {
                    content: "   ".to_owned(),
                },
            })
            .await
            .unwrap_err();

        assert_eq!(error.kind, MessageDomainErrorKind::Validation);
        assert_eq!(error.reason, "message_content_required");
    }

    #[tokio::test]
    async fn create_guild_channel_message_succeeds_when_last_message_index_update_is_unavailable() {
        let body = Arc::new(FakeBodyRepository {
            append_response: Some(sample_message()),
            ..Default::default()
        });
        let metadata = Arc::new(FakeMetadataRepository {
            record_error: Mutex::new(Some(MessageDomainError::dependency_unavailable(
                "message_metadata_last_message_update_failed",
            ))),
            ..Default::default()
        });
        let service = DefaultMessageService::new(
            Arc::clone(&body) as Arc<dyn MessageBodyRepository>,
            Arc::clone(&metadata) as Arc<dyn MessageMetadataRepository>,
            Arc::new(StaticClock),
            Arc::new(StaticIdGenerator),
        );

        let response = service
            .create_guild_channel_message(CreateGuildChannelMessageCommand {
                principal_id: PrincipalId(1001),
                guild_id: 10,
                channel_id: 20,
                request: CreateGuildChannelMessageRequestV1 {
                    content: "hello".to_owned(),
                },
            })
            .await
            .expect("last_message index update should be best-effort");

        assert_eq!(response.message.message_id, 123_456);
        assert_eq!(body.appended.lock().unwrap().len(), 1);
        assert!(metadata.recorded_message_ids.lock().unwrap().is_empty());
    }
}
