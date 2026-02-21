-- LIN-289: message_id 冪等保存戦略
-- 目的: 再送 / 再接続で同一 message_id が再到達しても重複行を作らない。
-- 前提: bucket 算出は決定的であり、同一 message_id は同一 bucket に解決される。
-- 非対象: MessageUpdated / MessageDeleted の保存戦略（別Issue）。

-- 推奨整合性設定（アプリ実行時）
-- CONSISTENCY LOCAL_QUORUM;
-- SERIAL CONSISTENCY LOCAL_SERIAL;

-- [適用順序 1/3] message_id を含む主キーに対して LWT で保存を試行する。
INSERT INTO chat.messages_by_channel (
  channel_id,
  bucket,
  message_id,
  author_id,
  content,
  version,
  edited_at,
  is_deleted,
  deleted_at,
  deleted_by,
  created_at
) VALUES (
  :channel_id,
  :bucket,
  :message_id,
  :author_id,
  :content,
  :version,
  null,
  false,
  null,
  null,
  :created_at
) IF NOT EXISTS;

-- [適用順序 2/3] 結果解釈
-- [applied] = true  -> 初回保存成功
-- [applied] = false -> 既存行あり。duplicate として no-op 扱いで成功終了

-- [適用順序 3/3] 再送 / 再接続時（ACK未達・タイムアウト時）の read-before-retry
-- 1) 既存確認
SELECT message_id
FROM chat.messages_by_channel
WHERE channel_id = :channel_id
  AND bucket = :bucket
  AND message_id = :message_id;
-- 2) 行が存在する場合: 既に保存済みとして成功終了（再INSERTしない）
-- 3) 行が存在しない場合: 同じ値で INSERT ... IF NOT EXISTS を再実行

-- 検証シナリオ（cqlsh 実行例）
TRUNCATE chat.messages_by_channel;

-- 初回保存: [applied] = true を期待
INSERT INTO chat.messages_by_channel (
  channel_id, bucket, message_id, author_id, content, version,
  edited_at, is_deleted, deleted_at, deleted_by, created_at
) VALUES (
  10, 20260221, 10001, 501, 'hello', 1,
  null, false, null, null, '2026-02-21T01:00:00Z'
) IF NOT EXISTS;

-- 重複保存: [applied] = false を期待（no-op）
INSERT INTO chat.messages_by_channel (
  channel_id, bucket, message_id, author_id, content, version,
  edited_at, is_deleted, deleted_at, deleted_by, created_at
) VALUES (
  10, 20260221, 10001, 501, 'hello', 1,
  null, false, null, null, '2026-02-21T01:00:00Z'
) IF NOT EXISTS;

-- 重複行が増えていないことを確認（期待値: 1）
SELECT COUNT(*) AS row_count
FROM chat.messages_by_channel
WHERE channel_id = 10
  AND bucket = 20260221;
