# LIN-635 Implement Rules

- 既存履歴カーソル/冪等保存契約（LIN-288/289）を変更しない。
- 返信参照先 `reply_to_message_id` には Postgres FK を張らず、トゥームストーン整合を優先する。
- 変更は additive migration で導入し、既存テーブル/関数/トリガーを破壊しない。
- schema変更時は `database/postgres/schema.sql` と `database/postgres/generated` を再生成する。
