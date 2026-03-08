use async_trait::async_trait;
use linklynx_message_api::{
    ListGuildChannelMessagesQueryV1, ListGuildChannelMessagesResponseV1, MessageItemV1,
};

use crate::{GuildChannelContext, MessageUsecaseError};

/// message body SoR port を表現する。
#[async_trait]
pub trait MessageBodyStore: Send + Sync {
    /// guild channel message を append する。
    /// @param message 保存対象 message snapshot
    /// @returns 保存済み message snapshot
    /// @throws MessageUsecaseError 依存障害時
    async fn append_guild_channel_message(
        &self,
        message: &MessageItemV1,
    ) -> Result<MessageItemV1, MessageUsecaseError>;

    /// guild channel message history を list する。
    /// @param context channel context
    /// @param query 正規化済み query
    /// @returns list response
    /// @throws MessageUsecaseError validation または依存障害時
    async fn list_guild_channel_messages(
        &self,
        context: &GuildChannelContext,
        query: &ListGuildChannelMessagesQueryV1,
    ) -> Result<ListGuildChannelMessagesResponseV1, MessageUsecaseError>;
}

/// message metadata repository port を表現する。
#[async_trait]
pub trait MessageMetadataRepository: Send + Sync {
    /// channel context を取得する。
    /// @param channel_id 対象 channel_id
    /// @returns channel context。未存在時は `None`
    /// @throws MessageUsecaseError 依存障害時
    async fn get_guild_channel_context(
        &self,
        channel_id: i64,
    ) -> Result<Option<GuildChannelContext>, MessageUsecaseError>;

    /// channel_last_message を monotonic に更新する。
    /// @param channel_id 対象 channel_id
    /// @param message_id 最新 message_id
    /// @param created_at 最新 created_at
    /// @returns 更新成功時は `()`
    /// @throws MessageUsecaseError 依存障害時
    async fn upsert_last_message(
        &self,
        channel_id: i64,
        message_id: i64,
        created_at: &str,
    ) -> Result<(), MessageUsecaseError>;
}
