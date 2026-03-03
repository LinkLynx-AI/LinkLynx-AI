# LIN-857 Documentation Log

## Status
- Implementation completed (schema contraction + docs/seed update).

## Scope
- Added migration:
  - `database/postgres/migrations/0011_lin857_drop_legacy_permission_assets_post_cutover.up.sql`
  - `database/postgres/migrations/0011_lin857_drop_legacy_permission_assets_post_cutover.down.sql`
- Added contract:
  - `database/contracts/lin857_legacy_permission_assets_removal_contract.md`
- Updated related docs:
  - `docs/DATABASE.md`
  - `docs/AUTHZ.md`
  - `database/contracts/lin632_spicedb_role_model_migration_contract.md`
- Updated seed:
  - `database/postgres/seed.sql`（v0権限テーブル参照を除去）
- Regenerated artifacts:
  - `database/postgres/schema.sql`
  - `database/postgres/generated/*`

## Validation results
- `make db-migrate`: passed（`0011`適用含む）。
- `make db-seed`: passed。
- `make db-schema`: passed。
- `make db-schema-check`: passed。
- `make gen`: passed。
- `make validate`: passed。

## Data checks
- `role_level` enum / `guild_roles` / `guild_member_roles` / `channel_permission_overrides` が存在しないことを確認。
- `seed.sql` の投入が v2モデルのみで成功することを確認。

## Review results
- `reviewer_simple` / `reviewer_ui_guard` / `reviewer_ui`: unavailable in current execution environment.
- Manual self-review: no blocking issues found in changed scope.

## Per-issue evidence (LIN-857)
- issue: `LIN-857`
- branch: `codex/LIN-857-drop-legacy-permission-assets`
- PR: pending
- planned PR base branch: `codex/LIN-634-channel-hierarchy-db`
