# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: if validation fails, fix before next milestone.

## Milestones
### M1: Backend server update API
- Acceptance criteria:
  - [x] `PATCH /guilds/{guild_id}` implemented.
  - [x] owner/admin-manage boundary enforced.
  - [x] fail-close compatible status/code mapping preserved.
  - [x] structured logs added for success/denied/validation.
- Validation:
  - `cargo test --manifest-path rust/Cargo.toml -p linklynx_backend patch_guild_`
  - `cargo test --manifest-path rust/Cargo.toml -p linklynx_backend guild_channel::tests`

### M2: Frontend API + mutation + settings UI
- Acceptance criteria:
  - [x] API client `updateServer` wired to PATCH endpoint.
  - [x] `useUpdateServer` mutation updates query cache for immediate rail sync.
  - [x] server settings overview loads selected server and saves name update.
  - [x] validation reason shown in FE for blank/too-long names.
- Validation:
  - `npm -C typescript run test -- src/shared/api/guild-channel-api-client.test.ts src/features/context-menus/ui/server-context-menu.test.tsx src/features/settings/ui/server/server-overview.test.tsx`

### M3: Full checks + review gates
- Acceptance criteria:
  - [x] `make validate` passes.
  - [x] `make rust-lint` passes.
  - [x] `cd typescript && npm run typecheck` passes.
  - [x] reviewer gates executed and recorded (`reviewer_simple`).
  - [x] runtime smoke attempted and result recorded.
- Validation:
  - `make validate`
  - `make rust-lint`
  - `npm -C typescript run typecheck`
