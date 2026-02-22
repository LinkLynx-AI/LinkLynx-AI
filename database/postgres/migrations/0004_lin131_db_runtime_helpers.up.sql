CREATE OR REPLACE FUNCTION upsert_channel_reads_monotonic(
  p_channel_id BIGINT,
  p_user_id BIGINT,
  p_last_read_message_id BIGINT,
  p_last_client_seq BIGINT
)
RETURNS VOID
LANGUAGE sql
AS $$
INSERT INTO channel_reads (
  channel_id,
  user_id,
  last_read_message_id,
  last_client_seq,
  updated_at
)
VALUES (
  p_channel_id,
  p_user_id,
  p_last_read_message_id,
  p_last_client_seq,
  now()
)
ON CONFLICT (channel_id, user_id)
DO UPDATE
SET
  last_read_message_id = CASE
    WHEN channel_reads.last_read_message_id IS NULL THEN EXCLUDED.last_read_message_id
    WHEN EXCLUDED.last_read_message_id IS NULL THEN channel_reads.last_read_message_id
    ELSE GREATEST(channel_reads.last_read_message_id, EXCLUDED.last_read_message_id)
  END,
  last_client_seq = CASE
    WHEN channel_reads.last_client_seq IS NULL THEN EXCLUDED.last_client_seq
    WHEN EXCLUDED.last_client_seq IS NULL THEN channel_reads.last_client_seq
    ELSE GREATEST(channel_reads.last_client_seq, EXCLUDED.last_client_seq)
  END,
  updated_at = now();
$$;

CREATE OR REPLACE FUNCTION claim_outbox_events(
  p_limit INTEGER DEFAULT 50,
  p_lease_seconds INTEGER DEFAULT 30
)
RETURNS TABLE (
  id BIGINT,
  event_type TEXT,
  aggregate_id TEXT,
  payload JSONB
)
LANGUAGE sql
AS $$
WITH pending AS (
  SELECT outbox_events.id
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
  LIMIT p_limit
  FOR UPDATE SKIP LOCKED
)
UPDATE outbox_events o
SET
  next_retry_at = now() + make_interval(secs => p_lease_seconds),
  updated_at = now()
FROM pending
WHERE o.id = pending.id
RETURNING o.id, o.event_type, o.aggregate_id, o.payload;
$$;

CREATE OR REPLACE FUNCTION mark_outbox_event_sent(
  p_id BIGINT
)
RETURNS VOID
LANGUAGE sql
AS $$
UPDATE outbox_events
SET
  status = 'SENT',
  next_retry_at = NULL,
  updated_at = now()
WHERE id = p_id;
$$;

CREATE OR REPLACE FUNCTION mark_outbox_event_failed(
  p_id BIGINT,
  p_retry_seconds INTEGER DEFAULT 15
)
RETURNS VOID
LANGUAGE sql
AS $$
UPDATE outbox_events
SET
  status = 'FAILED',
  attempts = attempts + 1,
  next_retry_at = now() + make_interval(secs => p_retry_seconds),
  updated_at = now()
WHERE id = p_id;
$$;
