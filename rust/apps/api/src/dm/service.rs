/// DM 相手ユーザーの要約を表現する。
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct DmRecipientSummary {
    pub user_id: i64,
    pub display_name: String,
    pub avatar_key: Option<String>,
}

/// DM チャンネル要約を表現する。
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct DmChannelSummary {
    pub channel_id: i64,
    pub created_at: String,
    pub last_message_id: Option<i64>,
    pub recipient: DmRecipientSummary,
}

/// DM API ユースケース境界を表現する。
#[async_trait]
pub trait DmService: Send + Sync {
    /// principal が参加する DM 一覧を返す。
    /// @param principal_id 認証済み主体
    /// @returns DM 一覧
    /// @throws DmError 非参加者/依存障害時
    async fn list_dm_channels(
        &self,
        principal_id: PrincipalId,
    ) -> Result<Vec<DmChannelSummary>, DmError>;

    /// principal が参加する DM 詳細を返す。
    /// @param principal_id 認証済み主体
    /// @param channel_id 対象 channel
    /// @returns DM 詳細
    /// @throws DmError 非参加者/未存在/依存障害時
    async fn get_dm_channel(
        &self,
        principal_id: PrincipalId,
        channel_id: i64,
    ) -> Result<DmChannelSummary, DmError>;

    /// 相手ユーザーとの DM を open-or-create する。
    /// @param principal_id 認証済み主体
    /// @param recipient_id 相手ユーザー
    /// @returns 既存または新規 DM
    /// @throws DmError 入力不正/依存障害時
    async fn open_or_create_dm(
        &self,
        principal_id: PrincipalId,
        recipient_id: i64,
    ) -> Result<DmChannelSummary, DmError>;

    /// DM 履歴を返す。
    /// @param principal_id 認証済み主体
    /// @param channel_id 対象 channel
    /// @param query list query
    /// @returns message history
    /// @throws DmError 非参加者/未存在/依存障害時
    async fn list_dm_messages(
        &self,
        principal_id: PrincipalId,
        channel_id: i64,
        query: ListGuildChannelMessagesQueryV1,
    ) -> Result<ListGuildChannelMessagesResponseV1, DmError>;

    /// DM メッセージを投稿する。
    /// @param principal_id 認証済み主体
    /// @param channel_id 対象 channel
    /// @param idempotency_key caller supplied key
    /// @param request 投稿入力
    /// @returns create execution
    /// @throws DmError 非参加者/未存在/依存障害時
    async fn create_dm_message(
        &self,
        principal_id: PrincipalId,
        channel_id: i64,
        idempotency_key: Option<&str>,
        request: CreateGuildChannelMessageRequestV1,
    ) -> Result<CreateGuildChannelMessageExecution, DmError>;
}

/// 依存未構成時に fail-close させる DM サービスを表現する。
#[derive(Clone)]
pub struct UnavailableDmService {
    reason: String,
}

impl UnavailableDmService {
    /// unavailable service を生成する。
    /// @param reason unavailable 理由
    /// @returns unavailable service
    /// @throws なし
    pub fn new(reason: impl Into<String>) -> Self {
        Self {
            reason: reason.into(),
        }
    }

    fn unavailable_error(&self) -> DmError {
        DmError::dependency_unavailable(self.reason.clone())
    }
}

#[async_trait]
impl DmService for UnavailableDmService {
    async fn list_dm_channels(
        &self,
        _principal_id: PrincipalId,
    ) -> Result<Vec<DmChannelSummary>, DmError> {
        Err(self.unavailable_error())
    }

    async fn get_dm_channel(
        &self,
        _principal_id: PrincipalId,
        _channel_id: i64,
    ) -> Result<DmChannelSummary, DmError> {
        Err(self.unavailable_error())
    }

    async fn open_or_create_dm(
        &self,
        _principal_id: PrincipalId,
        _recipient_id: i64,
    ) -> Result<DmChannelSummary, DmError> {
        Err(self.unavailable_error())
    }

    async fn list_dm_messages(
        &self,
        _principal_id: PrincipalId,
        _channel_id: i64,
        _query: ListGuildChannelMessagesQueryV1,
    ) -> Result<ListGuildChannelMessagesResponseV1, DmError> {
        Err(self.unavailable_error())
    }

    async fn create_dm_message(
        &self,
        _principal_id: PrincipalId,
        _channel_id: i64,
        _idempotency_key: Option<&str>,
        _request: CreateGuildChannelMessageRequestV1,
    ) -> Result<CreateGuildChannelMessageExecution, DmError> {
        Err(self.unavailable_error())
    }
}
