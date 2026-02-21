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
-- - :cursor_ts       timestamp
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
--    cursor より「古い」行を取得する。
--    同一 timestamp は message_id でタイブレークする。
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
  AND (created_at, message_id) < (:cursor_ts, :cursor_message_id)
ORDER BY message_id DESC
LIMIT :limit_plus_one
ALLOW FILTERING;

-- 3) backward (newer) ページ
--    走査方向: 古い -> 新しい（逆方向移動）
--    cursor より「新しい」行を取得し、返却前に昇順へ反転する前提。
--    同一 timestamp は message_id でタイブレークする。
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
  AND (created_at, message_id) > (:cursor_ts, :cursor_message_id)
ORDER BY message_id ASC
LIMIT :limit_plus_one
ALLOW FILTERING;
