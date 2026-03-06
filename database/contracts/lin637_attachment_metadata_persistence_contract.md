# LIN-637 添付メタデータ永続化契約（GCS運用契約準拠）

## Purpose

- target issue: LIN-637
- 添付バイナリ本体をGCS SoRのまま維持しつつ、署名URL運用に必要なメタデータをPostgresへ永続化する。
- 論理削除/保持期間追跡の最小監査列を定義する。
- `database/contracts/lin590_gcs_signed_url_and_retention_baseline.md` との整合方針を固定する。

## Scope

In scope:
- `message_attachments_v2`
- `object_key`, `mime_type`, `size_bytes`, `sha256`, `uploaded_by`, `created_at`
- `deleted_at`, `retention_until` の運用列

Out of scope:
- バイナリ本体保存先の変更
- CDN最適化や画像変換基盤
- 署名URL発行API実装

## 1. Data model

### 1.1 `message_attachments_v2`

- PK: `(message_id, object_key)`
- FK:
  - `channel_id -> channels(id) ON DELETE CASCADE`
  - `uploaded_by -> users(id) ON DELETE SET NULL`
- columns:
  - `message_id`
  - `channel_id`
  - `object_key`
  - `mime_type`
  - `size_bytes`
  - `sha256`
  - `uploaded_by`
  - `created_at`
  - `deleted_at`
  - `retention_until`

### 1.2 Multi-attachment contract

- 1メッセージに複数添付を許容する（同一 `message_id` に複数 `object_key` を保持可能）。
- `object_key` は全体一意（`uq_msg_att_v2_object_key`）とし、同一オブジェクトキーの二重登録を防止する。

## 2. GCS baseline alignment (LIN-590)

`lin590` との整合ルール:

1. `object_key` は `v0/tenant/...` プレフィックスを必須とする（最小命名制約）。
2. バイナリSoRはGCSであり、DBはメタデータSoRのみを扱う。
3. `retention_until` は保持期間管理の基準時刻として利用し、即時物理削除を前提にしない。
4. `deleted_at` は論理削除の監査時刻として利用する。

補足:

- 固定キー構造（`v0/tenant/{tenant_id}/guild/{guild_id}/channel/{channel_id}/message/{message_id}/asset/{asset_id}/{filename}`）の完全検証はアプリ層で実施し、DB側は最小プレフィックス制約で逸脱を抑止する。

## 3. Index policy

- `idx_msg_att_v2_message_created`:
  - メッセージ単位での添付一覧取得（新しい順）を想定。
- `idx_msg_att_v2_retention_active`:
  - `retention_until` 到達判定対象（未論理削除）を効率的に抽出。
- `idx_msg_att_v2_deleted_at`:
  - 論理削除済み監査/回収ジョブの抽出を想定。

## 4. Compatibility policy

- LIN-590（GCS運用契約）と矛盾しない。
- LIN-635/636 までのメッセージ関連スキーマを破壊しない additive 変更とする。
- message本文SoR（Scylla）に対する破壊的変更は行わない。

## 5. Validation

```bash
make db-migrate
make db-schema
make db-schema-check
make validate
```

Optional SQL example:

```sql
INSERT INTO message_attachments_v2(
  message_id, channel_id, object_key, mime_type, size_bytes, sha256, uploaded_by
) VALUES (
  92001,
  3001,
  'v0/tenant/t1/guild/2001/channel/3001/message/92001/asset/a1/file.png',
  'image/png',
  12345,
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  1001
);

UPDATE message_attachments_v2
SET deleted_at = now(), retention_until = now() + interval '7 days'
WHERE message_id = 92001
  AND object_key = 'v0/tenant/t1/guild/2001/channel/3001/message/92001/asset/a1/file.png';
```
