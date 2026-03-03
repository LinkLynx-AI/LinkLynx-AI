# LIN-634 Plan

## Milestones
1. 既存 `channels` 契約を維持する additive 設計を確定する。
2. `channel_hierarchy_kind` と `channel_hierarchies_v2` を migration 追加する。
3. 同一guild・guild_text限定を trigger で強制する。
4. 契約文書を `database/contracts` に追加する。
5. `docs/DATABASE.md` を更新する。
6. `db-schema` / `db-schema-check` / `gen` を実行し結果を記録する。

## Validation commands
- `make db-migrate`
- `make db-schema`
- `make db-schema-check`
- `make validate`

## Acceptance checks
- category親配下に複数 child channel を保持可能。
- thread は `parent_message_id` を必須にして識別可能。
- DM channel が階層テーブルへ混入しない（triggerで拒否）。
