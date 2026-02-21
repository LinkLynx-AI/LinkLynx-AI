-- LIN-291: 履歴境界ケース再現データ
-- 目的:
-- - 同一 timestamp 境界
-- - message_id 欠番
-- - 重複試行（IF NOT EXISTS）
-- - limit + 1 境界
-- を同一パーティションで再現し、LIN-288/289 の契約検証に再利用する。
--
-- 注意:
-- - 検証専用データ。実運用データへの投入は非対象。
-- - 既存スキーマ `database/scylla/001_lin139_messages.cql` 適用済み前提。

-- [0] 検証パーティション初期化（ローカル検証専用）
DELETE FROM chat.messages_by_channel
WHERE channel_id = 910001
  AND bucket = 20260221;

-- [1] ベースデータ投入（欠番を含む）
-- message_id: 120110, 120108, 120107, 120105, 120102, 120100, 120099
-- 欠番:      120109, 120106, 120104, 120103, 120101
INSERT INTO chat.messages_by_channel (
  channel_id, bucket, message_id, author_id, content, version,
  edited_at, is_deleted, deleted_at, deleted_by, created_at
) VALUES (
  910001, 20260221, 120110, 5001, 'lin291-m120110', 1,
  null, false, null, null, '2026-02-21T10:00:06Z'
) IF NOT EXISTS;

INSERT INTO chat.messages_by_channel (
  channel_id, bucket, message_id, author_id, content, version,
  edited_at, is_deleted, deleted_at, deleted_by, created_at
) VALUES (
  910001, 20260221, 120108, 5002, 'lin291-m120108', 1,
  null, false, null, null, '2026-02-21T10:00:05Z'
) IF NOT EXISTS;

INSERT INTO chat.messages_by_channel (
  channel_id, bucket, message_id, author_id, content, version,
  edited_at, is_deleted, deleted_at, deleted_by, created_at
) VALUES (
  910001, 20260221, 120107, 5003, 'lin291-m120107', 1,
  null, false, null, null, '2026-02-21T10:00:05Z'
) IF NOT EXISTS;

INSERT INTO chat.messages_by_channel (
  channel_id, bucket, message_id, author_id, content, version,
  edited_at, is_deleted, deleted_at, deleted_by, created_at
) VALUES (
  910001, 20260221, 120105, 5004, 'lin291-m120105', 1,
  null, false, null, null, '2026-02-21T10:00:04Z'
) IF NOT EXISTS;

INSERT INTO chat.messages_by_channel (
  channel_id, bucket, message_id, author_id, content, version,
  edited_at, is_deleted, deleted_at, deleted_by, created_at
) VALUES (
  910001, 20260221, 120102, 5005, 'lin291-m120102', 1,
  null, false, null, null, '2026-02-21T10:00:02Z'
) IF NOT EXISTS;

INSERT INTO chat.messages_by_channel (
  channel_id, bucket, message_id, author_id, content, version,
  edited_at, is_deleted, deleted_at, deleted_by, created_at
) VALUES (
  910001, 20260221, 120100, 5006, 'lin291-m120100', 1,
  null, false, null, null, '2026-02-21T10:00:02Z'
) IF NOT EXISTS;

INSERT INTO chat.messages_by_channel (
  channel_id, bucket, message_id, author_id, content, version,
  edited_at, is_deleted, deleted_at, deleted_by, created_at
) VALUES (
  910001, 20260221, 120099, 5007, 'lin291-m120099', 1,
  null, false, null, null, '2026-02-21T10:00:01Z'
) IF NOT EXISTS;

-- [2] 重複試行（LIN-289 整合）
-- 期待: [applied] = false（duplicate no-op）
INSERT INTO chat.messages_by_channel (
  channel_id, bucket, message_id, author_id, content, version,
  edited_at, is_deleted, deleted_at, deleted_by, created_at
) VALUES (
  910001, 20260221, 120107, 5003, 'lin291-m120107', 1,
  null, false, null, null, '2026-02-21T10:00:05Z'
) IF NOT EXISTS;

-- 期待: row_count = 7（重複で増えない）
SELECT COUNT(*) AS row_count
FROM chat.messages_by_channel
WHERE channel_id = 910001
  AND bucket = 20260221;

-- [3] 欠番/並び確認
-- 期待順: 120110,120108,120107,120105,120102,120100,120099
SELECT message_id, created_at
FROM chat.messages_by_channel
WHERE channel_id = 910001
  AND bucket = 20260221
ORDER BY message_id DESC;

-- [4] limit + 1 境界（LIN-288 整合）
-- 想定クライアント limit=3 -> DB は limit_plus_one=4
-- 期待: 4行取得（先頭3行を返却、4行目は nextCursor 判定用）
SELECT message_id, created_at
FROM chat.messages_by_channel
WHERE channel_id = 910001
  AND bucket = 20260221
ORDER BY message_id DESC
LIMIT 4;

-- [5] 同一 timestamp 境界（forward / older）
-- cursor=(2026-02-21T10:00:05Z, 120107)
-- 同一 timestamp の 120108 は除外されることを確認する。
-- 期待順: 120105,120102,120100,120099
SELECT message_id, created_at
FROM chat.messages_by_channel
WHERE channel_id = 910001
  AND bucket = 20260221
  AND (created_at, message_id) < ('2026-02-21T10:00:05Z', 120107)
ORDER BY message_id DESC
LIMIT 4
ALLOW FILTERING;

-- [6] 同一 timestamp 境界（backward / newer）
-- cursor=(2026-02-21T10:00:05Z, 120107)
-- 期待順: 120108,120110（ASC）
SELECT message_id, created_at
FROM chat.messages_by_channel
WHERE channel_id = 910001
  AND bucket = 20260221
  AND (created_at, message_id) > ('2026-02-21T10:00:05Z', 120107)
ORDER BY message_id ASC
LIMIT 4
ALLOW FILTERING;

-- [7] 最終ページ境界（余剰1件なし）
-- cursor=(2026-02-21T10:00:02Z, 120100), limit_plus_one=4
-- 期待: 120099 の1行のみ（nextCursor 非発行）
SELECT message_id, created_at
FROM chat.messages_by_channel
WHERE channel_id = 910001
  AND bucket = 20260221
  AND (created_at, message_id) < ('2026-02-21T10:00:02Z', 120100)
ORDER BY message_id DESC
LIMIT 4
ALLOW FILTERING;
