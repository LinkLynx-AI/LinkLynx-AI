use std::sync::Arc;

use async_trait::async_trait;
use linklynx_message_api::MessageItemV1;
use linklynx_message_domain::{MessageDomainError, MessageMetadataRepository};
use linklynx_shared::PrincipalId;
use tokio_postgres::Client;

/// Postgres-backed message metadata repository を表現する。
#[derive(Clone)]
pub struct PostgresMessageMetadataRepository {
    client: Arc<Client>,
}

impl PostgresMessageMetadataRepository {
    /// Postgres metadata repository を生成する。
    /// @param client Postgres client
    /// @returns metadata repository
    /// @throws なし
    pub fn new(client: Arc<Client>) -> Self {
        Self { client }
    }

    async fn ensure_guild_channel_membership(
        &self,
        principal_id: PrincipalId,
        guild_id: i64,
        channel_id: i64,
    ) -> Result<(), MessageDomainError> {
        let row = self
            .client
            .query_opt(
                "SELECT
                    c.guild_id,
                    EXISTS (
                      SELECT 1
                      FROM guild_members gm
                      WHERE gm.guild_id = c.guild_id
                        AND gm.user_id = $3
                    ) AS is_member
                 FROM channels c
                 WHERE c.id = $1
                   AND c.type = 'guild_text'",
                &[&channel_id, &guild_id, &principal_id.0],
            )
            .await
            .map_err(|error| {
                MessageDomainError::dependency_unavailable(format!(
                    "message_metadata_membership_query_failed:{error}"
                ))
            })?;

        let Some(row) = row else {
            return Err(MessageDomainError::channel_not_found(
                "message_channel_not_found",
            ));
        };

        let actual_guild_id = row.get::<usize, i64>(0);
        if actual_guild_id != guild_id {
            return Err(MessageDomainError::channel_not_found(
                "message_channel_guild_mismatch",
            ));
        }

        let is_member = row.get::<usize, bool>(1);
        if !is_member {
            return Err(MessageDomainError::forbidden(
                "message_channel_access_denied",
            ));
        }

        Ok(())
    }
}

#[async_trait]
impl MessageMetadataRepository for PostgresMessageMetadataRepository {
    async fn ensure_can_list_guild_channel_messages(
        &self,
        principal_id: PrincipalId,
        guild_id: i64,
        channel_id: i64,
    ) -> Result<(), MessageDomainError> {
        self.ensure_guild_channel_membership(principal_id, guild_id, channel_id)
            .await
    }

    async fn ensure_can_create_guild_channel_message(
        &self,
        principal_id: PrincipalId,
        guild_id: i64,
        channel_id: i64,
    ) -> Result<(), MessageDomainError> {
        self.ensure_guild_channel_membership(principal_id, guild_id, channel_id)
            .await
    }

    async fn record_guild_channel_message_created(
        &self,
        message: &MessageItemV1,
    ) -> Result<(), MessageDomainError> {
        self.client
            .execute(
                "INSERT INTO channel_last_message (
                    channel_id,
                    last_message_id,
                    last_message_at
                 ) VALUES ($1, $2, $3::timestamptz)
                 ON CONFLICT (channel_id) DO UPDATE
                 SET
                    last_message_id = EXCLUDED.last_message_id,
                    last_message_at = EXCLUDED.last_message_at
                 WHERE EXCLUDED.last_message_at >= channel_last_message.last_message_at",
                &[
                    &message.channel_id,
                    &message.message_id,
                    &message.created_at,
                ],
            )
            .await
            .map_err(|error| {
                MessageDomainError::dependency_unavailable(format!(
                    "message_metadata_last_message_update_failed:{error}"
                ))
            })?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn constructor_keeps_client() {
        let _ = PostgresMessageMetadataRepository::new;
    }
}
