# LIN-292 DB Runtime Helpers Contract

## 目的

アプリ実装差分に依存せず、DB側で以下の実行契約を固定する。

- `channel_reads` の単調増加更新（逆行更新の防止）
- `outbox_events` の claim / sent / failed の状態遷移

## 追加関数

### `upsert_channel_reads_monotonic(...)`

- 対象: `channel_reads`
- 仕様:
  - `ON CONFLICT (channel_id, user_id)` で upsert
  - `last_read_message_id` / `last_client_seq` は `GREATEST` による単調増加
  - `NULL` 入力時は既存値を保持

### `claim_outbox_events(p_limit, p_lease_seconds)`

- 対象: `outbox_events`
- 仕様:
  - claim対象:
    - `status='PENDING'` かつ `next_retry_at IS NULL OR <= now()`
    - `status='FAILED'` かつ `next_retry_at <= now()`
  - `FOR UPDATE SKIP LOCKED` で競合回避
  - claim時に `next_retry_at = now() + lease` を設定

### `mark_outbox_event_sent(p_id)`

- 対象イベントを `SENT` へ遷移
- `next_retry_at = NULL`

### `mark_outbox_event_failed(p_id, p_retry_seconds)`

- 対象イベントを `FAILED` へ遷移
- `attempts = attempts + 1`
- `next_retry_at = now() + retry_seconds`

## 関連ファイル

- migration up: `database/postgres/migrations/0004_lin131_db_runtime_helpers.up.sql`
- migration down: `database/postgres/migrations/0004_lin131_db_runtime_helpers.down.sql`
- schema snapshot: `database/postgres/schema.sql`
