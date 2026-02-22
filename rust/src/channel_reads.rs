use serde::{Deserialize, Serialize};
use sqlx::{postgres::PgPool, Executor, Postgres};
use thiserror::Error;

const CHANNEL_READS_UPSERT_SQL: &str =
    include_str!("../../database/postgres/channel_reads_upsert.sql");

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub struct ChannelReadUpsertInput {
    pub channel_id: i64,
    pub user_id: i64,
    pub last_read_message_id: Option<i64>,
    pub last_client_seq: Option<i64>,
}

#[derive(Debug, Error)]
pub enum ChannelReadsError {
    #[error("database connection is not configured")]
    DbUnavailable,
    #[error("database query failed: {0}")]
    Query(#[from] sqlx::Error),
}

#[derive(Clone)]
pub struct ChannelReadsRepository {
    pool: Option<PgPool>,
}

impl ChannelReadsRepository {
    pub fn new(pool: Option<PgPool>) -> Self {
        Self { pool }
    }

    pub async fn upsert(
        &self,
        input: &ChannelReadUpsertInput,
    ) -> Result<(), ChannelReadsError> {
        let pool = self.pool.as_ref().ok_or(ChannelReadsError::DbUnavailable)?;
        self.upsert_with_executor(pool, input).await
    }

    pub async fn upsert_with_executor<'e, E>(
        &self,
        exec: E,
        input: &ChannelReadUpsertInput,
    ) -> Result<(), ChannelReadsError>
    where
        E: Executor<'e, Database = Postgres>,
    {
        sqlx::query(CHANNEL_READS_UPSERT_SQL)
            .bind(input.channel_id)
            .bind(input.user_id)
            .bind(input.last_read_message_id)
            .bind(input.last_client_seq)
            .execute(exec)
            .await?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deserialize_input_payload() {
        let payload = r#"{
          "channel_id": 10,
          "user_id": 20,
          "last_read_message_id": 120,
          "last_client_seq": 8
        }"#;

        let parsed: ChannelReadUpsertInput = serde_json::from_str(payload).unwrap();
        assert_eq!(
            parsed,
            ChannelReadUpsertInput {
                channel_id: 10,
                user_id: 20,
                last_read_message_id: Some(120),
                last_client_seq: Some(8),
            }
        );
    }
}
