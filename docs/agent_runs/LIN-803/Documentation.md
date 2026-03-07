# LIN-803 Documentation Log

## Status
- Completed (implementation scope)

## Applied work
- Added migration files:
  - `0015_lin803_server_channel_minimal_contract.up.sql`
  - `0015_lin803_server_channel_minimal_contract.down.sql`
- Updated `docs/DATABASE.md` with LIN-803 migration/index/constraint summaries.
- Added `database/contracts/lin803_server_channel_minimal_contract.md`.
- Added run memory files under `docs/agent_runs/LIN-803`.

## Validation results
- `make db-up`: passed (with escalated Docker permission).
- `make db-migrate`: failed (`sqlx: command not found`).
- `/bin/zsh -lc 'for f in database/postgres/migrations/*.up.sql; ...'`: executed to apply the LIN-803 migration on running Postgres for schema regeneration.
- `make db-schema POSTGRES_DUMP_CMD=...`: passed.
- `make db-schema-check`: passed (with escalated Docker permission).
- `make gen`: passed.
- `make rust-lint`: passed.
- `make validate`: failed (TypeScript side `prettier: command not found`, `node_modules` missing).
- `cd typescript && npm run typecheck`: failed (`tsc: command not found`).
- `npm -C typescript ci`: failed (`package-lock.json` mismatch).
- `cd typescript && CI=true pnpm install --frozen-lockfile`: failed (`ENOTFOUND registry.npmjs.org` due network restriction in this environment).
- DB smoke checks (Docker Postgres + psql):
  - `INSERT INTO guilds (name, owner_id) VALUES ('lin803-guild', ...) RETURNING id` => passed (`id` auto-generated).
  - `INSERT INTO channels (type, guild_id, name, created_by) VALUES ('guild_text', ..., 'general', ...) RETURNING id` => passed (`id` auto-generated).
  - `INSERT INTO guilds (name='   ', ...)` => failed as expected with `chk_guilds_name_not_blank`.
  - `INSERT INTO channels (type='guild_text', name='   ', ...)` => failed as expected with `chk_channels_guild_text_name_not_blank`.
  - `EXPLAIN` for server-rail query confirms `idx_guild_members_user_joined_guild`.
  - `EXPLAIN` for channel-list query confirms `idx_channels_guild_created_id`.

## Notes
- This issue intentionally does not introduce strict membership integrity triggers.
- TypeScript validation is blocked by environment/package resolution state, not by LIN-803 DB changes.
- Historical references to `0008_lin803_server_channel_minimal_contract` were renumbered to `0015_lin803_server_channel_minimal_contract` on 2026-03-07 to resolve duplicate `sqlx` migration versions without changing schema intent.
