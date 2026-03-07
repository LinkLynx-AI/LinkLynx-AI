# LIN-636 Plan

## Milestones
1. リアクション永続化テーブルを additive migration（0013）で追加する。
2. `(message_id, emoji, user_id)` 制約で重複付与を防止する。
3. 集計（count）取得方針を契約文書に明記する。
4. `docs/DATABASE.md` を更新する。
5. `db-migrate` / `db-schema` / `db-schema-check` / `gen` / `validate` を実行する。

## Validation commands
- `make db-migrate`
- `make db-schema`
- `make db-schema-check`
- `make gen`
- `make validate`

## Acceptance checks
- 同一リアクションの二重INSERTが制約で防止される。
- add/removeが冪等運用できる。
- message_id基準の集計クエリ前提が契約化される。
