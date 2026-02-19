-- LIN-139 monotonic and NULL-safe upsert contract for channel_reads.
-- Reverse movement is prohibited for last_read_message_id and last_client_seq.

INSERT INTO channel_reads (
  channel_id,
  user_id,
  last_read_message_id,
  last_client_seq,
  updated_at
) VALUES (
  $1,
  $2,
  $3,
  $4,
  now()
)
ON CONFLICT (channel_id, user_id)
DO UPDATE SET
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
