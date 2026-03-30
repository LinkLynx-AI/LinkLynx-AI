# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: if validation fails, repair it before moving to the next step.

## Milestones
### M1: Persist channel ownership in invite storage
- Acceptance criteria:
  - [ ] `invites` stores nullable `channel_id` with FK/index.
  - [ ] Schema docs reflect the new column.
- Validation:
  - `cargo test -p api invite::tests`

### M2: Make backend invite payloads channel-aware
- Acceptance criteria:
  - [ ] invite create/list/verify/join payloads expose channel metadata.
  - [ ] guild invite list/revoke accepts optional `channel_id` filter.
  - [ ] backend tests cover guild-wide and channel-scoped behavior.
- Validation:
  - `cargo test -p api invite::tests main::tests -- --nocapture`

### M3: Split frontend invite surfaces by scope
- Acceptance criteria:
  - [ ] API client/query/mutation support optional `channelId`.
  - [ ] channel settings uses channel-scoped invite list/revoke.
  - [ ] server settings shows channel metadata for guild-wide invites.
- Validation:
  - `cd typescript && npm test -- --runInBand src/shared/api/guild-channel-api-client.test.ts src/features/modals/ui/channel-edit-invites.test.tsx src/features/settings/ui/server/server-invites.test.tsx src/entities/ui-gateway/api/api-ui-gateway.test.ts`
  - `cd typescript && npm run typecheck`

### M4: Repository-wide validation
- Acceptance criteria:
  - [ ] repo validation passes for the changed surfaces.
- Validation:
  - `make validate`
  - `make rust-lint`
