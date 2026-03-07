# LIN-635 メッセージ参照/固定（返信・ピン）永続化契約

## Purpose

- target issue: LIN-635
- 返信参照（`reply_to_message_id`）とピン留め状態（`pinned_at` / `pinned_by`）をDBで永続化する。
- 既存メッセージ保存契約（LIN-288/289）を破壊しない前提で、削除済み参照先のトゥームストーン整合方針を定義する。

## Scope

In scope:
- `message_references_v2`
- `channel_pins_v2`
- 返信参照の一意性（`message_id` 単位）
- ピン留め/解除の監査列定義

Out of scope:
- 返信通知配信、UI表示仕様
- 検索インデックス仕様の全面見直し
- メッセージ本文SoR（Scylla）構造の変更

## 1. Data model

### 1.1 `message_references_v2`

- PK: `message_id`
- FK:
  - `channel_id -> channels(id) ON DELETE CASCADE`
- columns:
  - `reply_to_message_id`（参照先メッセージID）
  - `created_at`
- checks:
  - `message_id <> reply_to_message_id`

### 1.2 `channel_pins_v2`

- PK: `(channel_id, message_id)`
- FK:
  - `channel_id -> channels(id) ON DELETE CASCADE`
  - `pinned_by -> users(id) ON DELETE SET NULL`
  - `unpinned_by -> users(id) ON DELETE SET NULL`
- audit columns:
  - `pinned_at`, `pinned_by`
  - `unpinned_at`, `unpinned_by`
  - `updated_at`
- checks:
  - unpin actor/time pair consistency
  - `unpinned_at >= pinned_at`

## 2. Tombstone compatibility policy

- `reply_to_message_id` は Scylla SoR の message identifier を参照するため、Postgres FKを張らない。
- 理由:
  1. メッセージ本文SoRは `database/scylla/*.cql`
  2. 参照先メッセージ削除後も返信元メタデータを保持し、UIで「削除済みメッセージ（tombstone）」として整合表示する必要がある
- したがって、参照先存在検証は write-path で実施し、削除時は参照行をカスケード削除しない。

## 3. Compatibility policy

- LIN-288（履歴カーソル）/ LIN-289（冪等保存）の既存契約は変更しない。
- 追加テーブルはいずれも additive で導入し、既存 `channel_last_message` / `channel_reads` 契約を壊さない。

## 4. Validation

```bash
make db-migrate
make db-schema
make db-schema-check
make validate
```

Optional SQL example:

```sql
-- reply metadata
INSERT INTO message_references_v2(message_id, channel_id, reply_to_message_id)
VALUES (91001, 101, 90001);

-- pin
INSERT INTO channel_pins_v2(channel_id, message_id, pinned_at, pinned_by)
VALUES (101, 90001, now(), 1);

-- unpin (audit preserved)
UPDATE channel_pins_v2
SET unpinned_at = now(), unpinned_by = 1, updated_at = now()
WHERE channel_id = 101 AND message_id = 90001;
```
