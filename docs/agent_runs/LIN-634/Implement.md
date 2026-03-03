# LIN-634 Implement Rules

- 既存 `channels` の `channel_type` は変更しない。
- 階層表現は新規テーブルで additive に導入する。
- `parent_message_id` は Scylla SoR参照のため Postgres FK を張らない。
- schema変更時は `database/postgres/schema.sql` と `database/postgres/generated` を再生成する。
