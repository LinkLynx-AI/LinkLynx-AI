use chrono::{DateTime, Duration, Utc};
use serde_json::Value;
use sqlx::{postgres::PgPool, types::Json};
use std::{future::Future, pin::Pin};
use thiserror::Error;
use tokio::time::MissedTickBehavior;

#[derive(Debug, Clone, Copy)]
pub struct OutboxWorkerConfig {
    pub batch_size: i64,
    pub lease_seconds: i64,
    pub poll_interval_seconds: u64,
}

impl Default for OutboxWorkerConfig {
    fn default() -> Self {
        Self {
            batch_size: 50,
            lease_seconds: 30,
            poll_interval_seconds: 2,
        }
    }
}

#[derive(Debug, Clone)]
pub struct OutboxEvent {
    pub id: i64,
    pub event_type: String,
    pub aggregate_id: String,
    pub payload: Value,
}

#[derive(Debug, Error)]
pub enum OutboxError {
    #[error("database error: {0}")]
    Db(#[from] sqlx::Error),
}

pub trait EventPublisher: Send + Sync + 'static {
    fn publish<'a>(
        &'a self,
        event_type: &'a str,
        payload: &'a Value,
        ordering_key: &'a str,
    ) -> Pin<Box<dyn Future<Output = Result<(), String>> + Send + 'a>>;
}

#[derive(Clone, Default)]
pub struct NoopEventPublisher;

impl EventPublisher for NoopEventPublisher {
    fn publish<'a>(
        &'a self,
        _event_type: &'a str,
        _payload: &'a Value,
        _ordering_key: &'a str,
    ) -> Pin<Box<dyn Future<Output = Result<(), String>> + Send + 'a>> {
        Box::pin(async { Ok(()) })
    }
}

#[derive(Clone)]
pub struct OutboxWorker<P: EventPublisher> {
    pool: PgPool,
    publisher: P,
    config: OutboxWorkerConfig,
}

impl<P: EventPublisher> OutboxWorker<P> {
    pub fn new(pool: PgPool, publisher: P, config: OutboxWorkerConfig) -> Self {
        Self {
            pool,
            publisher,
            config,
        }
    }

    pub async fn run_loop(self) {
        let mut ticker =
            tokio::time::interval(std::time::Duration::from_secs(self.config.poll_interval_seconds));
        ticker.set_missed_tick_behavior(MissedTickBehavior::Delay);

        loop {
            ticker.tick().await;
            if let Err(err) = self.tick().await {
                tracing::error!("outbox worker tick failed: {err}");
            }
        }
    }

    pub async fn tick(&self) -> Result<(), OutboxError> {
        let events = self.claim_pending_events().await?;

        for event in events {
            let ordering_key = compute_ordering_key(&event.aggregate_id, &event.payload);
            let publish_result = self
                .publisher
                .publish(&event.event_type, &event.payload, &ordering_key)
                .await;

            match publish_result {
                Ok(_) => {
                    self.mark_sent(event.id).await?;
                }
                Err(err) => {
                    self.mark_failed(event.id, err).await?;
                }
            }
        }

        Ok(())
    }

    async fn claim_pending_events(&self) -> Result<Vec<OutboxEvent>, OutboxError> {
        let lease_until: DateTime<Utc> = Utc::now() + Duration::seconds(self.config.lease_seconds);
        let rows = sqlx::query_as::<
            _,
            (i64, String, String, Json<Value>),
        >(
            r#"
WITH pending AS (
  SELECT id
  FROM outbox_events
  WHERE (
    status = 'PENDING'
    AND (next_retry_at IS NULL OR next_retry_at <= now())
  ) OR (
    status = 'FAILED'
    AND next_retry_at IS NOT NULL
    AND next_retry_at <= now()
  )
  ORDER BY created_at
  LIMIT $1
  FOR UPDATE SKIP LOCKED
)
UPDATE outbox_events o
SET next_retry_at = $2,
    updated_at = now()
FROM pending
WHERE o.id = pending.id
RETURNING o.id, o.event_type, o.aggregate_id, o.payload
"#,
        )
        .bind(self.config.batch_size)
        .bind(lease_until)
        .fetch_all(&self.pool)
        .await?;

        let events = rows
            .into_iter()
            .map(|(id, event_type, aggregate_id, payload)| OutboxEvent {
                id,
                event_type,
                aggregate_id,
                payload: payload.0,
            })
            .collect();
        Ok(events)
    }

    async fn mark_sent(&self, id: i64) -> Result<(), OutboxError> {
        sqlx::query(
            r#"
UPDATE outbox_events
SET status = 'SENT',
    next_retry_at = NULL,
    updated_at = now()
WHERE id = $1
"#,
        )
        .bind(id)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    async fn mark_failed(&self, id: i64, publisher_error: String) -> Result<(), OutboxError> {
        tracing::warn!("outbox publish failed id={id}: {publisher_error}");
        let next_retry_at: DateTime<Utc> = Utc::now() + Duration::seconds(15);

        sqlx::query(
            r#"
UPDATE outbox_events
SET status = 'FAILED',
    attempts = attempts + 1,
    next_retry_at = $2,
    updated_at = now()
WHERE id = $1
"#,
        )
        .bind(id)
        .bind(next_retry_at)
        .execute(&self.pool)
        .await?;
        Ok(())
    }
}

pub fn compute_ordering_key(aggregate_id: &str, payload: &Value) -> String {
    let maybe_channel_id = payload
        .get("message")
        .and_then(|message| message.get("channel_id"))
        .and_then(Value::as_i64);

    if let Some(channel_id) = maybe_channel_id {
        return format!("channel:{channel_id}");
    }

    format!("channel:{aggregate_id}")
}

#[cfg(test)]
mod tests {
    use super::compute_ordering_key;
    use serde_json::json;

    #[test]
    fn ordering_key_uses_message_channel_id_when_available() {
        let payload = json!({
          "message": { "channel_id": 42 }
        });
        let got = compute_ordering_key("fallback", &payload);
        assert_eq!(got, "channel:42");
    }

    #[test]
    fn ordering_key_falls_back_to_aggregate_id() {
        let payload = json!({
          "unexpected": true
        });
        let got = compute_ordering_key("guild:1", &payload);
        assert_eq!(got, "channel:guild:1");
    }
}
