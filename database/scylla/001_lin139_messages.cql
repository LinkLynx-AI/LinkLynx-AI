-- LIN-139: メッセージ本文用の Scylla スキーマ
-- Scylla クラスタ起動後に適用する。

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

-- 任意: message_id 直参照用テーブル
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

-- バケット運用規約（v1固定）
-- 1. 初期バケット幅は 10 日
-- 2. created_at または Snowflake の message_id から bucket を算出
-- 3. パーティション閾値超過時に実行時で bucket 幅変更を許容
