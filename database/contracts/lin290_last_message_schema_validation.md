# LIN-290 `channel_last_message` スキーマ/インデックス検証

## 検証対象

- `database/postgres/migrations/0003_lin139_permissions_reads_outbox.up.sql`
- `database/postgres/schema.sql`

## LIN-290 要件（確認対象）

- `channel_last_message` テーブル定義が存在すること
- 最終メッセージ更新に必要な列が揃っていること
- 更新時刻列（`updated_at`）が存在すること
- チャンネル一覧向けの時系列索引が存在すること

## 検証結果

1. テーブル定義は既存 migration に存在
- `database/postgres/migrations/0003_lin139_permissions_reads_outbox.up.sql:56` で `channel_last_message` を作成
- 列:
- `channel_id BIGINT PRIMARY KEY REFERENCES channels(id) ON DELETE CASCADE`
- `last_message_id BIGINT NOT NULL`
- `last_message_at TIMESTAMPTZ NOT NULL`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`

2. インデックス定義は既存 migration に存在
- `database/postgres/migrations/0003_lin139_permissions_reads_outbox.up.sql:63` で `idx_channel_last_message_time`
- 定義: `ON channel_last_message (last_message_at DESC)`

3. `schema.sql` スナップショットにも同等定義を確認
- テーブル: `database/postgres/schema.sql:103`
- 主キー: `database/postgres/schema.sql:289`
- インデックス: `database/postgres/schema.sql:393`
- 外部キー: `database/postgres/schema.sql:459`

## 判定

- LIN-290 の Postgres スキーマ/インデックス要件は **既存定義で充足**。
- 追加 migration（`0004_lin290_last_message_index_tuning`）は不要。
- Prisma 側も同等モデル/索引定義が既に存在するため、本Issueでは変更なし（非対象方針に合致）。

## 実施コマンド（証跡）

```bash
rg -n "channel_last_message|idx_channel_last_message_time|updated_at" \
  database/postgres/migrations/0003_lin139_permissions_reads_outbox.up.sql \
  database/postgres/schema.sql
```
