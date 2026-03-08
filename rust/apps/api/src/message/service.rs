const MESSAGE_REQUEST_IDENTITY_TTL: Duration = Duration::from_secs(600);
const MESSAGE_REQUEST_IDENTITY_CACHE_MAX: usize = 8_192;

#[derive(Debug, Clone)]
struct MessageRequestIdentity {
    message_id: i64,
    created_at: String,
}

#[derive(Debug, Clone)]
struct CachedMessageRequestIdentity {
    identity: MessageRequestIdentity,
    expires_at: Instant,
}

#[derive(Default)]
struct MessageRequestIdentityCacheState {
    entries: HashMap<String, CachedMessageRequestIdentity>,
    order: VecDeque<String>,
}

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
    /// @param request_id 冪等キーへ利用する request_id
    /// @param request 作成入力
    /// @returns 作成レスポンス
    /// @throws MessageError validation / not found / dependency unavailable 時
    async fn create_guild_channel_message(
        &self,
        principal_id: PrincipalId,
        guild_id: i64,
        channel_id: i64,
        request_id: &str,
        request: CreateGuildChannelMessageRequestV1,
    ) -> Result<CreateGuildChannelMessageResponseV1, MessageError>;
}

/// 実行時 message service を表現する。
#[derive(Clone)]
pub struct RuntimeMessageService {
    usecase: Arc<dyn MessageUsecase>,
    request_identity_cache: Arc<Mutex<MessageRequestIdentityCacheState>>,
    request_identity_ttl: Duration,
    request_identity_cache_max: usize,
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
            request_identity_cache: Arc::new(Mutex::new(
                MessageRequestIdentityCacheState::default(),
            )),
            request_identity_ttl: MESSAGE_REQUEST_IDENTITY_TTL,
            request_identity_cache_max: MESSAGE_REQUEST_IDENTITY_CACHE_MAX,
            next_message_id: Arc::new(AtomicI64::new(0)),
        }
    }

    #[cfg(test)]
    fn new_for_test(
        usecase: Arc<dyn MessageUsecase>,
        request_identity_ttl: Duration,
        request_identity_cache_max: usize,
    ) -> Self {
        Self {
            usecase,
            request_identity_cache: Arc::new(Mutex::new(
                MessageRequestIdentityCacheState::default(),
            )),
            request_identity_ttl,
            request_identity_cache_max,
            next_message_id: Arc::new(AtomicI64::new(0)),
        }
    }

    async fn request_identity(
        &self,
        principal_id: PrincipalId,
        channel_id: i64,
        request_id: &str,
    ) -> Result<MessageRequestIdentity, MessageError> {
        let cache_key = format!("{}:{channel_id}:{request_id}", principal_id.0);
        let now = Instant::now();
        let mut cache = self.request_identity_cache.lock().await;

        self.evict_expired_locked(&mut cache, now);

        if let Some(entry) = cache.entries.get(&cache_key) {
            return Ok(entry.identity.clone());
        }

        self.evict_capacity_locked(&mut cache);

        let identity = self.allocate_request_identity()?;
        cache.entries.insert(
            cache_key.clone(),
            CachedMessageRequestIdentity {
                identity: identity.clone(),
                expires_at: now + self.request_identity_ttl,
            },
        );
        cache.order.push_back(cache_key);
        Ok(identity)
    }

    fn evict_expired_locked(
        &self,
        cache: &mut MessageRequestIdentityCacheState,
        now: Instant,
    ) {
        while let Some(front) = cache.order.front().cloned() {
            let should_pop = match cache.entries.get(&front) {
                Some(entry) if entry.expires_at <= now => {
                    cache.entries.remove(&front);
                    true
                }
                Some(_) => false,
                None => true,
            };
            if !should_pop {
                break;
            }
            cache.order.pop_front();
        }
    }

    fn evict_capacity_locked(&self, cache: &mut MessageRequestIdentityCacheState) {
        while cache.entries.len() >= self.request_identity_cache_max {
            let Some(front) = cache.order.pop_front() else {
                break;
            };
            cache.entries.remove(&front);
        }
    }

    fn allocate_request_identity(&self) -> Result<MessageRequestIdentity, MessageError> {
        let now = OffsetDateTime::now_utc();
        self.allocate_request_identity_at(now)
    }

    #[cfg(test)]
    fn allocate_request_identity_at(
        &self,
        now: OffsetDateTime,
    ) -> Result<MessageRequestIdentity, MessageError> {
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

        Ok(MessageRequestIdentity {
            message_id,
            created_at,
        })
    }

    #[cfg(not(test))]
    fn allocate_request_identity_at(
        &self,
        now: OffsetDateTime,
    ) -> Result<MessageRequestIdentity, MessageError> {
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

        Ok(MessageRequestIdentity {
            message_id,
            created_at,
        })
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
    /// @param request_id 冪等キーへ利用する request_id
    /// @param request 作成入力
    /// @returns 作成レスポンス
    /// @throws MessageError validation / not found / dependency unavailable 時
    async fn create_guild_channel_message(
        &self,
        principal_id: PrincipalId,
        guild_id: i64,
        channel_id: i64,
        request_id: &str,
        request: CreateGuildChannelMessageRequestV1,
    ) -> Result<CreateGuildChannelMessageResponseV1, MessageError> {
        let identity = self
            .request_identity(principal_id, channel_id, request_id)
            .await?;
        let message = self
            .usecase
            .append_guild_channel_message(AppendGuildChannelMessageCommand {
                guild_id,
                channel_id,
                author_id: principal_id.0,
                message_id: identity.message_id,
                content: request.content,
                created_at: identity.created_at,
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
    /// @param _request_id 冪等キーへ利用する request_id
    /// @param _request 作成入力
    /// @returns なし
    /// @throws MessageError 常に unavailable
    async fn create_guild_channel_message(
        &self,
        _principal_id: PrincipalId,
        _guild_id: i64,
        _channel_id: i64,
        _request_id: &str,
        _request: CreateGuildChannelMessageRequestV1,
    ) -> Result<CreateGuildChannelMessageResponseV1, MessageError> {
        Err(self.unavailable_error())
    }
}

#[cfg(test)]
#[allow(clippy::items_after_test_module)]
mod tests {
    use super::*;
    use std::collections::HashSet;
    use time::{format_description::well_known::Rfc3339, OffsetDateTime};
    use tokio::sync::Mutex;

    #[derive(Default)]
    struct RecordingMessageUsecase {
        appended: Mutex<Vec<AppendGuildChannelMessageCommand>>,
    }

    #[async_trait]
    impl MessageUsecase for RecordingMessageUsecase {
        async fn append_guild_channel_message(
            &self,
            command: AppendGuildChannelMessageCommand,
        ) -> Result<linklynx_message_api::MessageItemV1, MessageUsecaseError> {
            self.appended.lock().await.push(command.clone());
            Ok(command.to_message_item())
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
    async fn same_request_id_reuses_message_identity_within_process() {
        let usecase = Arc::new(RecordingMessageUsecase::default());
        let service = RuntimeMessageService::new_for_test(
            usecase.clone(),
            Duration::from_secs(600),
            MESSAGE_REQUEST_IDENTITY_CACHE_MAX,
        );

        let _ = service
            .create_guild_channel_message(
                PrincipalId(9003),
                10,
                20,
                "req-1",
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
                "req-1",
                CreateGuildChannelMessageRequestV1 {
                    content: "second".to_owned(),
                },
            )
            .await
            .unwrap();

        let appended = usecase.appended.lock().await;
        assert_eq!(appended.len(), 2);
        assert_eq!(appended[0].message_id, appended[1].message_id);
        assert_eq!(appended[0].created_at, appended[1].created_at);
    }

    #[tokio::test]
    async fn different_request_identity_keys_allocate_distinct_message_ids() {
        let usecase = Arc::new(RecordingMessageUsecase::default());
        let service = RuntimeMessageService::new_for_test(
            usecase.clone(),
            Duration::from_secs(600),
            MESSAGE_REQUEST_IDENTITY_CACHE_MAX,
        );

        let _ = service
            .create_guild_channel_message(
                PrincipalId(9003),
                10,
                20,
                "req-1",
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
                21,
                "req-1",
                CreateGuildChannelMessageRequestV1 {
                    content: "second".to_owned(),
                },
            )
            .await
            .unwrap();
        let _ = service
            .create_guild_channel_message(
                PrincipalId(9003),
                10,
                20,
                "req-2",
                CreateGuildChannelMessageRequestV1 {
                    content: "third".to_owned(),
                },
            )
            .await
            .unwrap();

        let appended = usecase.appended.lock().await;
        assert_eq!(appended.len(), 3);
        assert_ne!(appended[0].message_id, appended[1].message_id);
        assert_ne!(appended[0].message_id, appended[2].message_id);
    }

    #[tokio::test]
    async fn expired_request_identity_is_regenerated() {
        let usecase = Arc::new(RecordingMessageUsecase::default());
        let service = RuntimeMessageService::new_for_test(
            usecase.clone(),
            Duration::ZERO,
            MESSAGE_REQUEST_IDENTITY_CACHE_MAX,
        );

        let _ = service
            .create_guild_channel_message(
                PrincipalId(9003),
                10,
                20,
                "req-1",
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
                "req-1",
                CreateGuildChannelMessageRequestV1 {
                    content: "second".to_owned(),
                },
            )
            .await
            .unwrap();

        let appended = usecase.appended.lock().await;
        assert_eq!(appended.len(), 2);
        assert_ne!(appended[0].message_id, appended[1].message_id);
    }

    #[tokio::test]
    async fn capacity_eviction_regenerates_oldest_request_identity() {
        let usecase = Arc::new(RecordingMessageUsecase::default());
        let service =
            RuntimeMessageService::new_for_test(usecase.clone(), Duration::from_secs(600), 1);

        let _ = service
            .create_guild_channel_message(
                PrincipalId(9003),
                10,
                20,
                "req-1",
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
                "req-2",
                CreateGuildChannelMessageRequestV1 {
                    content: "second".to_owned(),
                },
            )
            .await
            .unwrap();
        let _ = service
            .create_guild_channel_message(
                PrincipalId(9003),
                10,
                20,
                "req-1",
                CreateGuildChannelMessageRequestV1 {
                    content: "third".to_owned(),
                },
            )
            .await
            .unwrap();

        let appended = usecase.appended.lock().await;
        assert_eq!(appended.len(), 3);
        assert_ne!(appended[0].message_id, appended[2].message_id);
    }

    #[test]
    fn allocate_message_id_remains_unique_when_timestamp_is_identical() {
        let service = RuntimeMessageService::new_for_test(
            Arc::new(RecordingMessageUsecase::default()),
            Duration::from_secs(600),
            MESSAGE_REQUEST_IDENTITY_CACHE_MAX,
        );
        let now = OffsetDateTime::parse("2026-03-08T10:11:12.123456789Z", &Rfc3339).unwrap();
        let mut ids = HashSet::new();

        for _ in 0..1_500 {
            let identity = service.allocate_request_identity_at(now).unwrap();
            assert!(ids.insert(identity.message_id));
            assert_eq!(identity.created_at, "2026-03-08T10:11:12Z");
        }
    }
}
