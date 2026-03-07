# LIN-636 Implement Rules

- 変更は additive migration とし、既存 `LIN-635` までの契約を破壊しない。
- 重複リアクション防止はアプリ層ではなくDB主キー制約で担保する。
- add/removeの冪等性は `ON CONFLICT DO NOTHING` / `DELETE no-op` 前提で定義する。
- schema変更時は `database/postgres/schema.sql` と `database/postgres/generated` を再生成する。
