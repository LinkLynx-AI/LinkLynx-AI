# LIN-822 Minimal Moderation Contract

## Metadata

- Target issue: LIN-822
- Scope: minimal moderation persistence for report/mute and audit trail linkage
- Current repo artifact key: `0016_lin822_minimal_moderation`

## Fixed contract

This contract fixes the minimum Postgres baseline for moderation in the current repository state.

1. Report state enum
- `moderation_report_status` exists with `open` and `resolved`.

2. Audit action extension
- `audit_action` includes:
  - `REPORT_CREATE`
  - `MUTE_CREATE`
  - `REPORT_RESOLVE`
  - `REPORT_REOPEN`

3. Reports table
- `moderation_reports` stores:
  - `guild_id`
  - `reporter_id`
  - `target_type`
  - `target_id`
  - `reason`
  - `status`
  - `resolved_by`
  - `resolved_at`
  - `created_at`
  - `updated_at`
- `target_type` is restricted to `message` or `user`.
- `reason` rejects blank values.
- Resolution columns must be consistent with `status`.

4. Mutes table
- `moderation_mutes` stores:
  - `guild_id`
  - `target_user_id`
  - `reason`
  - `created_by`
  - `expires_at`
  - `created_at`
- One active row per `(guild_id, target_user_id)` is enforced by unique constraint.
- `reason` rejects blank values.

5. Read-path indexes
- `idx_moderation_reports_guild_status_created`
- `idx_moderation_reports_guild_created`
- `idx_moderation_mutes_guild_created`
- `idx_moderation_mutes_expires_at`

## Operations and compatibility

- This change is additive and forward-only under LIN-588.
- The current repository uses `0016_lin822_minimal_moderation`.
- Historical run documents may still mention `0012_lin822_minimal_moderation`; the file was renumbered on 2026-03-07 to resolve a duplicate `sqlx` migration version collision without changing schema intent.
- Implementation traceability must be artifact-first: migration basename, contract path, and `docs/agent_runs` references remain the local source of truth even if Linear issue hierarchy or status changes later.

## References

- `docs/DATABASE.md`
- `docs/V1_TRACEABILITY.md`
- `docs/agent_runs/LIN-802/Documentation.md`
- `database/postgres/migrations/0016_lin822_minimal_moderation.up.sql`
- `database/postgres/migrations/0016_lin822_minimal_moderation.down.sql`
