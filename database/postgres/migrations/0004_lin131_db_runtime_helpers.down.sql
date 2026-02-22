DROP FUNCTION IF EXISTS mark_outbox_event_failed(BIGINT, INTEGER);
DROP FUNCTION IF EXISTS mark_outbox_event_sent(BIGINT);
DROP FUNCTION IF EXISTS claim_outbox_events(INTEGER, INTEGER);
DROP FUNCTION IF EXISTS upsert_channel_reads_monotonic(BIGINT, BIGINT, BIGINT, BIGINT);
