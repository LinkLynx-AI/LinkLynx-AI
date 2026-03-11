use linklynx_message_api::{
    CreateGuildChannelMessageRequestV1, DeleteGuildChannelMessageRequestV1,
    EditGuildChannelMessageRequestV1, MessageApiError, MessageItemV1,
};
use thiserror::Error;

/// message identity を表現する。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MessageIdentity {
    pub message_id: i64,
    pub created_at: String,
}

/// durable idempotency 入力を表現する。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MessageCreateIdempotency {
    pub key: String,
    pub payload_fingerprint: String,
}

/// guild channel message create command を表現する。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CreateGuildChannelMessageCommand {
    pub guild_id: i64,
    pub channel_id: i64,
    pub author_id: i64,
    pub content: String,
    pub proposed_identity: MessageIdentity,
    pub idempotency: Option<MessageCreateIdempotency>,
}

impl CreateGuildChannelMessageCommand {
    /// validation 用 request shape へ変換する。
    /// @param なし
    /// @returns create request
    /// @throws なし
    pub fn to_create_request(&self) -> CreateGuildChannelMessageRequestV1 {
        CreateGuildChannelMessageRequestV1 {
            content: self.content.clone(),
        }
    }

    /// 指定 identity で public message snapshot へ変換する。
    /// @param identity 採用する message identity
    /// @returns message item
    /// @throws なし
    pub fn to_message_item(&self, identity: &MessageIdentity) -> MessageItemV1 {
        MessageItemV1 {
            message_id: identity.message_id,
            guild_id: self.guild_id,
            channel_id: self.channel_id,
            author_id: self.author_id,
            content: self.content.clone(),
            created_at: identity.created_at.clone(),
            version: 1,
            edited_at: None,
            is_deleted: false,
        }
    }
}

/// guild channel message create の実行結果を表現する。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CreateGuildChannelMessageResult {
    pub message: MessageItemV1,
    pub should_publish: bool,
}

/// guild channel message edit command を表現する。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EditGuildChannelMessageCommand {
    pub guild_id: i64,
    pub channel_id: i64,
    pub principal_id: i64,
    pub message_id: i64,
    pub content: String,
    pub expected_version: i64,
    pub edited_at: String,
}

impl EditGuildChannelMessageCommand {
    /// validation 用 request shape へ変換する。
    /// @param なし
    /// @returns edit request
    /// @throws なし
    pub fn to_edit_request(&self) -> EditGuildChannelMessageRequestV1 {
        EditGuildChannelMessageRequestV1 {
            content: self.content.clone(),
            expected_version: self.expected_version,
        }
    }
}

/// guild channel message delete command を表現する。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DeleteGuildChannelMessageCommand {
    pub guild_id: i64,
    pub channel_id: i64,
    pub principal_id: i64,
    pub message_id: i64,
    pub expected_version: i64,
    pub deleted_at: String,
}

impl DeleteGuildChannelMessageCommand {
    /// validation 用 request shape へ変換する。
    /// @param なし
    /// @returns delete request
    /// @throws なし
    pub fn to_delete_request(&self) -> DeleteGuildChannelMessageRequestV1 {
        DeleteGuildChannelMessageRequestV1 {
            expected_version: self.expected_version,
        }
    }
}

/// guild channel message update の結果を表現する。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UpdateGuildChannelMessageResult {
    pub message: MessageItemV1,
}

/// idempotency reservation 状態を表現する。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MessageCreateReservationState {
    Reserved,
    Completed,
}

/// idempotency reservation を表現する。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MessageCreateReservation {
    pub identity: MessageIdentity,
    pub state: MessageCreateReservationState,
}

/// reservation 取得結果を表現する。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MessageCreateReserveResult {
    Reserved(MessageCreateReservation),
    PayloadMismatch,
}

/// guild channel の message read/write に必要な context を表現する。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GuildChannelContext {
    pub channel_id: i64,
    pub guild_id: i64,
    pub created_at: String,
    pub last_message_id: Option<i64>,
    pub last_message_at: Option<String>,
}

/// conditional write の結果を表現する。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MessageStoreUpdateResult {
    Applied,
    Conflict,
}

/// message usecase の失敗を表現する。
#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum MessageUsecaseError {
    #[error("validation failed: {0}")]
    Validation(String),
    #[error("channel not found: {0}")]
    ChannelNotFound(String),
    #[error("message not found: {0}")]
    MessageNotFound(String),
    #[error("authz denied: {0}")]
    AuthzDenied(String),
    #[error("conflict: {0}")]
    Conflict(String),
    #[error("dependency unavailable: {0}")]
    DependencyUnavailable(String),
}

impl MessageUsecaseError {
    /// validation エラーを生成する。
    /// @param reason 失敗理由
    /// @returns validation error
    /// @throws なし
    pub fn validation(reason: impl Into<String>) -> Self {
        Self::Validation(reason.into())
    }

    /// channel not found エラーを生成する。
    /// @param reason 失敗理由
    /// @returns not found error
    /// @throws なし
    pub fn channel_not_found(reason: impl Into<String>) -> Self {
        Self::ChannelNotFound(reason.into())
    }

    /// message not found エラーを生成する。
    /// @param reason 失敗理由
    /// @returns not found error
    /// @throws なし
    pub fn message_not_found(reason: impl Into<String>) -> Self {
        Self::MessageNotFound(reason.into())
    }

    /// authz denied エラーを生成する。
    /// @param reason 失敗理由
    /// @returns authz denied error
    /// @throws なし
    pub fn authz_denied(reason: impl Into<String>) -> Self {
        Self::AuthzDenied(reason.into())
    }

    /// conflict エラーを生成する。
    /// @param reason 失敗理由
    /// @returns conflict error
    /// @throws なし
    pub fn conflict(reason: impl Into<String>) -> Self {
        Self::Conflict(reason.into())
    }

    /// dependency unavailable エラーを生成する。
    /// @param reason 失敗理由
    /// @returns dependency unavailable error
    /// @throws なし
    pub fn dependency_unavailable(reason: impl Into<String>) -> Self {
        Self::DependencyUnavailable(reason.into())
    }

    /// transport 向け reason code を返す。
    /// @param なし
    /// @returns reason code
    /// @throws なし
    pub fn reason_code(&self) -> &str {
        match self {
            Self::Validation(reason)
            | Self::ChannelNotFound(reason)
            | Self::MessageNotFound(reason)
            | Self::AuthzDenied(reason)
            | Self::Conflict(reason)
            | Self::DependencyUnavailable(reason) => reason.as_str(),
        }
    }
}

impl From<MessageApiError> for MessageUsecaseError {
    fn from(value: MessageApiError) -> Self {
        Self::validation(value.reason_code())
    }
}
