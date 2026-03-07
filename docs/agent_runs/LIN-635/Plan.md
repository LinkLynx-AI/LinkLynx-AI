# LIN-635 Plan

## Milestones
1. 返信参照とピン状態のDDLを additive migration（0012）として定義する。
2. 返信参照の一意性（`message_id` 単位）とピン監査列の整合チェックを制約で定義する。
3. トゥームストーン整合（参照先にFKを張らない方針）を契約文書へ明記する。
4. `docs/DATABASE.md` を現行状態へ更新する。
5. `db-migrate` / `db-schema` / `db-schema-check` / `gen` / `validate` を実行して証跡化する。
6. PR修正として CI に `make db-schema-check` を追加し、fresh Postgres へ migration SQL を順に適用してから schema snapshot 検証を自動化する。

## Validation commands
- `make db-migrate`
- `make db-schema`
- `make db-schema-check`
- `make gen`
- `make validate`

## Acceptance checks
- `message_references_v2` で `message_id` の一意追跡が可能。
- `channel_pins_v2` で pin/unpin 監査列が保持される。
- 削除済み参照先を想定したトゥームストーン方針が契約化されている。
- PR の CI で `make db-schema-check` が実行される。
