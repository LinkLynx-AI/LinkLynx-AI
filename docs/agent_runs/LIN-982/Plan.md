# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: if validation fails, repair it before moving to the next step.

## Milestones
### M1: Rust invite list / revoke backend
- Acceptance criteria:
  - [x] `InviteService` / Postgres 実装に list と revoke が追加されている。
  - [x] `GET` / `DELETE` invite routes が v1 protected route として動く。
  - [x] rate limit / authz / audit / docs が更新されている。
- Validation:
  - `cd rust && cargo test -p linklynx_api invite`
  - `cd rust && cargo test -p linklynx_api main::tests::`

### M2: TypeScript invite client / UI wiring
- Acceptance criteria:
  - [x] `GuildChannelAPIClient` に list / revoke が実装されている。
  - [x] `ServerInvites` と `ChannelEditInvites` が real API を使う。
  - [x] invite 型と tests が backend contract に揃っている。
- Validation:
  - `cd typescript && npm test -- src/shared/api/guild-channel-api-client.test.ts src/features/modals/ui/create-invite-modal.test.tsx`

### M3: Full validation and evidence
- Acceptance criteria:
  - [x] `make validate` が通る。
  - [x] 追加 decisions / demo / known gaps が `Documentation.md` に反映されている。
  - [x] review/run summary を残せる。
- Validation:
  - `make validate`
  - `make rust-lint`
  - `cd typescript && npm run typecheck`
