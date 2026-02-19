-- LIN-139 Scylla schema for message bodies
-- Apply after Scylla cluster is ready.

CREATE KEYSPACE IF NOT EXISTS chat
WITH replication = {'class': 'NetworkTopologyStrategy', 'dc1': 3};

CREATE TABLE IF NOT EXISTS chat.messages_by_channel (
  channel_id bigint,
  bucket int,
  message_id bigint,
  author_id bigint,
  content text,
  version bigint,
  edited_at timestamp,
  is_deleted boolean,
  deleted_at timestamp,
  deleted_by bigint,
  created_at timestamp,
  PRIMARY KEY ((channel_id, bucket), message_id)
) WITH CLUSTERING ORDER BY (message_id DESC);

-- Optional direct-lookup table.
CREATE TABLE IF NOT EXISTS chat.messages_by_id (
  message_id bigint PRIMARY KEY,
  channel_id bigint,
  bucket int,
  author_id bigint,
  content text,
  version bigint,
  edited_at timestamp,
  is_deleted boolean,
  deleted_at timestamp,
  deleted_by bigint,
  created_at timestamp
);

-- Bucket operation policy (fixed for v1):
-- 1. Start with 10-day bucket width.
-- 2. Compute bucket from created_at or Snowflake message_id.
-- 3. Allow runtime bucket-width change when partition threshold is exceeded.
