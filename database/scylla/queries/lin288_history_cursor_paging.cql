-- LIN-288: 履歴カーソル走査クエリ（再利用資産）
--
-- 目的:
-- - cursor 比較キーを `(created_at, message_id)` として統一する
-- - forward / backward のページングを同一契約で扱う
-- - `LIMIT :limit_plus_one` で nextCursor 判定を可能にする
--
-- 想定入力:
-- - :channel_id      bigint
-- - :bucket          int
-- - :cursor_message_id bigint
-- - :limit_plus_one  int   -- 呼び出し側で `limit + 1` を計算して渡す

-- 1) 初回ページ（最新側から取得）
--    cursor なし時に使用する。
SELECT
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
FROM chat.messages_by_channel
WHERE channel_id = :channel_id
  AND bucket = :bucket
ORDER BY message_id DESC
LIMIT :limit_plus_one;

-- 2) forward (older) ページ
--    走査方向: 新しい -> 古い
--    cursor の `created_at` から bucket を解決した上で、
--    同一 bucket 内では clustering key の `message_id` で「古い」行を取得する。
SELECT
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
FROM chat.messages_by_channel
WHERE channel_id = :channel_id
  AND bucket = :bucket
  AND message_id < :cursor_message_id
ORDER BY message_id DESC
LIMIT :limit_plus_one
ALLOW FILTERING;

-- 3) backward (newer) ページ
--    走査方向: 古い -> 新しい（逆方向移動）
--    cursor の `created_at` から bucket を解決した上で、
--    同一 bucket 内では clustering key の `message_id` で「新しい」行を取得する。
SELECT
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
FROM chat.messages_by_channel
WHERE channel_id = :channel_id
  AND bucket = :bucket
  AND message_id > :cursor_message_id
ORDER BY message_id ASC
LIMIT :limit_plus_one
ALLOW FILTERING;
