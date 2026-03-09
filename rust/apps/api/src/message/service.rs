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
    /// @returns 作成レスポンス
    /// @throws MessageError validation / not found / dependency unavailable 時
    async fn create_guild_channel_message(
        &self,
        principal_id: PrincipalId,
        guild_id: i64,
        channel_id: i64,
        idempotency_key: Option<&str>,
        request: CreateGuildChannelMessageRequestV1,
    ) -> Result<CreateGuildChannelMessageResponseV1, MessageError>;
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
    /// @returns 作成レスポンス
    /// @throws MessageError validation / not found / dependency unavailable 時
    async fn create_guild_channel_message(
        &self,
        principal_id: PrincipalId,
        guild_id: i64,
        channel_id: i64,
        idempotency_key: Option<&str>,
        request: CreateGuildChannelMessageRequestV1,
    ) -> Result<CreateGuildChannelMessageResponseV1, MessageError> {
        let identity = self.allocate_message_identity()?;
        let idempotency = self.build_idempotency(idempotency_key, &request)?;
        let message = self
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

        Ok(CreateGuildChannelMessageResponseV1 { message })
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
    ) -> Result<CreateGuildChannelMessageResponseV1, MessageError> {
        Err(self.unavailable_error())
    }
}

#[cfg(test)]
#[allow(clippy::items_after_test_module)]
mod tests {
    use super::*;
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
        ) -> Result<linklynx_message_api::MessageItemV1, MessageUsecaseError> {
            self.created.lock().await.push(command.clone());
            Ok(command.to_message_item(&command.proposed_identity))
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
        ) -> Result<linklynx_message_api::MessageItemV1, MessageUsecaseError> {
            let Some(idempotency) = command.idempotency.as_ref() else {
                return Ok(command.to_message_item(&command.proposed_identity));
            };

            let mut entries = self.entries.lock().await;
            if let Some(existing) = entries.get(&idempotency.key) {
                if existing.content != command.content {
                    return Err(MessageUsecaseError::validation(
                        "message_idempotency_payload_mismatch",
                    ));
                }
                return Ok(existing.clone());
            }

            let message = command.to_message_item(&command.proposed_identity);
            entries.insert(idempotency.key.clone(), message.clone());
            Ok(message)
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

        assert_eq!(first.message.message_id, second.message.message_id);
        assert_eq!(first.message.created_at, second.message.created_at);
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
