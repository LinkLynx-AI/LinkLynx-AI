# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: if validation fails, repair it before moving to the next step.

## Milestones
### M1: Rust read API を追加する
- Acceptance criteria:
  - [ ] `members / roles / user profile` service と route が追加される。
  - [ ] membership / shared guild guard が fail-close で実装される。
  - [ ] route-level tests で status / payload を固定する。
- Validation:
  - `cd rust && cargo test get_guild_members`
  - `cd rust && cargo test get_guild_roles`
  - `cd rust && cargo test get_user_profile`

### M2: TypeScript client と主要 UI を接続する
- Acceptance criteria:
  - [ ] `GuildChannelAPIClient` が新規 read endpoint を map する。
  - [ ] member/profile UI が query 結果から roles を解決する。
  - [ ] component/client tests が追加される。
- Validation:
  - `cd typescript && npm run test -- --run guild-channel-api-client.test.ts`
  - `cd typescript && npm run test -- --run member-list.test.tsx profile-popout.test.tsx profile-modal.test.tsx`

### M3: 全体検証を通す
- Acceptance criteria:
  - [ ] repo 規定 validation が成功する。
  - [ ] Documentation.md に結果を反映する。
- Validation:
  - `make validate`
  - `make rust-lint`
  - `cd typescript && npm run typecheck`
