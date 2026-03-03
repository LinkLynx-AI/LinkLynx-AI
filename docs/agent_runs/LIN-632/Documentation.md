# LIN-632 Documentation Log

## Status
- Implementation completed (DB schema + migration contract scope).

## Scope
- Added migration:
  - `database/postgres/migrations/0008_lin632_arbitrary_roles_spicedb_prep.up.sql`
  - `database/postgres/migrations/0008_lin632_arbitrary_roles_spicedb_prep.down.sql`
- Added contract:
  - `database/contracts/lin632_spicedb_role_model_migration_contract.md`
- Follow-up hardening:
  - `role_key` format constraint (`^[a-z0-9_]{1,64}$`) を migration に追加
  - `assigned_by ON DELETE SET NULL` の設計意図と role_key命名規則を契約文書へ明記
- Updated references:
  - `docs/DATABASE.md`
  - `docs/AUTHZ.md`
- Regenerated schema artifacts:
  - `database/postgres/schema.sql`
  - `database/postgres/generated/*`

## Validation results
- `make db-migrate`: failed in this environment because `sqlx` CLI is not installed.
- Fallback migration verification:
  - Applied all `database/postgres/migrations/*up.sql` in order via `psql` on temporary local Postgres (`COMPOSE_FILE=/tmp/linklynx-db-only-5432-compose.yml`).
  - `0008` applied successfully.
- `make db-schema`: passed.
- `make db-schema-check`: passed.
- `make gen`: passed.
- `make validate`: failed in this environment (`pnpm: No such file or directory`).

## Data checks
- `guild_roles` / `guild_roles_v2` counts: `0 / 0`
- `guild_member_roles` / `guild_member_roles_v2` counts: `0 / 0`
- `channel_permission_overrides` / `channel_role_permission_overrides_v2` counts: `0 / 0`

## Review results
- `reviewer_simple` / `reviewer_ui_guard` / `reviewer_ui`: unavailable in current execution environment.
- Manual self-review: no blocking issues found in changed scope.
- Claude auto-review feedback handling:
  - addressed: `role_key` naming rule ambiguity -> added DB constraint + contract rule.
  - addressed: `assigned_by ON DELETE SET NULL` rationale -> documented in contract.
  - evaluated (sabe comment): old permission columns/tables removal was requested; deferred intentionally due LIN-632 compatibility contract (dual-write/rollback safety). Retention scope is now explicitly documented in the contract.

## Per-issue evidence (LIN-632)
- issue: `LIN-632`
- branch: `codex/LIN-632-spicedb-role-model-migration`
- reviewer gate: unavailable (manual self-review fallback)
- UI gate: skipped (UI changesなし)
- PR: https://github.com/LinkLynx-AI/LinkLynx-AI/pull/985
- planned PR base branch: `codex/LIN-631-notion-auth-schema-gap`
- merge policy: stacked PR (`LIN-631` -> `LIN-632`)
