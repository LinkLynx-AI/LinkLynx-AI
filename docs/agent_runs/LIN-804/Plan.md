# LIN-804 Plan

## Rules
- Stop-and-fix: if validation fails, repair before the next step.

## Milestones
### M1: Profile module implementation
- Acceptance criteria:
  - [ ] `profile` モジュール（service/errors/postgres/runtime/tests）が追加される。
  - [ ] 入力制約が `display_name:1..32`, `status_text:0..190`, `avatar_key:[A-Za-z0-9/_\-.]+` で固定される。
- Validation:
  - `cd rust && cargo test -p linklynx_backend --locked profile::tests`

### M2: HTTP route wiring
- Acceptance criteria:
  - [ ] `GET /users/me/profile` と `PATCH /users/me/profile` が保護ルートに追加される。
  - [ ] エラー契約 `VALIDATION_ERROR` / `USER_NOT_FOUND` / `PROFILE_UNAVAILABLE` が固定される。
- Validation:
  - `cd rust && cargo test -p linklynx_backend --locked main::tests::get_my_profile_returns_profile`

### M3: Quality and evidence
- Acceptance criteria:
  - [ ] required quality commands and runtime smoke evidence are recorded.
- Validation:
  - `make validate`
  - `make rust-lint`
  - `cd typescript && npm run typecheck`
