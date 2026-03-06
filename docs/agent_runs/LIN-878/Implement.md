# Implement.md (Runbook)

- Follow Plan.md as the single execution order. If order changes are needed, document the reason in Documentation.md and update it.
- Keep diffs small and do not mix in out-of-scope improvements.
- Run validation after each milestone and fix failures immediately before continuing.
- Continuously update Documentation.md with decisions, progress, demo steps, and known issues.

## Execution log
- 2026-03-05: Started LIN-878 implementation on `codex/lin-878_2`.
- 2026-03-05: M1 backend completed.
  - Added `PATCH /channels/{channel_id}` route and handler.
  - Added `ChannelPatchInput` + `update_guild_channel` service boundary.
  - Added Postgres implementation with `guild_members` + `guild_member_roles_v2`/`guild_roles_v2` owner/admin (`allow_manage=true`) checks.
  - Added `CHANNEL_NOT_FOUND` error contract and backend tests.
- 2026-03-05: M2 frontend completed.
  - Implemented `GuildChannelAPIClient.updateChannel` via backend PATCH endpoint.
  - Added update-specific error text mapping (`toUpdateActionErrorText`).
  - Connected `ChannelEditOverview` to `useChannel` + `useUpdateChannel` (success close / failure inline error).
  - Synced React Query cache (`channels` + `channel`) and wired channel item settings button to open edit modal.
  - Added frontend tests (`channel-edit-overview`, `channel-item`, API client update path).
- 2026-03-05: Validation completed.
  - `cd rust && cargo test -p linklynx_backend guild_channel -- --nocapture`
  - `cd typescript && npm run test -- src/shared/api/guild-channel-api-client.test.ts src/features/modals/ui/channel-edit-overview.test.tsx src/widgets/channel-sidebar/ui/channel-item.test.tsx`
  - `cd typescript && npm run typecheck`
  - `make rust-lint`
  - `make validate`
- 2026-03-05: Review gates completed.
  - `reviewer_ui_guard`: `run_ui_checks: true`
  - `reviewer`: P1/P0 findingsなし（block条件なし）
  - `reviewer_ui`: P1/P0 findingsなし（block条件なし）
- 2026-03-05: Operational notes.
  - Package install needed for TypeScript tests (`pnpm install --frozen-lockfile`).
  - Initial network resolution error (`ENOTFOUND`) required escalated rerun.
  - Initial Vitest run hit `ENOSPC` in `node_modules/.vite-temp`; resolved by linking `.vite-temp` to `/tmp`.
