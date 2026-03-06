# LIN-637 Plan

## Milestones
1. 添付メタデータテーブルを additive migration（0014）で追加する。
2. object_key命名の最小制約と整合チェックを定義する。
3. 論理削除/保持列（deleted_at, retention_until）と監査用インデックスを追加する。
4. LIN-590整合方針を契約文書に明記する。
5. `db-migrate` / `db-schema` / `db-schema-check` / `gen` / `validate` を実行する。

## Validation commands
- `make db-migrate`
- `make db-schema`
- `make db-schema-check`
- `make gen`
- `make validate`

## Acceptance checks
- 1メッセージに複数添付を登録できる。
- 添付なしケースで関連行が存在しないことを確認できる。
- 論理削除と保持期限列の更新をSQLで確認できる。
