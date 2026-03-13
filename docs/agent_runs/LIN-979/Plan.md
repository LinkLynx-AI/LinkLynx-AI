# Plan

## Rules
- Stop-and-fix: validation / review 失敗時は先へ進まない。
- Scope lock: moderation boundary の再整合に限定し、実処理接続や permission-snapshot の新挙動は入れない。
- Start mode: child issue start (`LIN-979` under `LIN-976`)。

## Milestones
### M1: request scope と reject log を再整合する
- Acceptance criteria:
  - [ ] REST middleware の rate-limit / authz reject log に `guild_id` / `channel_id` が補完される
  - [ ] moderation path で `guild_id` が抽出される
- Validation:
  - `cd rust && cargo test -p linklynx_backend rest_authz_resource_maps_invite_dm_and_moderation_paths rest_request_scope_maps_moderation_permission_snapshot_and_dm_paths -- --nocapture`

### M2: matrix と runbook を current implementation に合わせる
- Acceptance criteria:
  - [ ] moderation PATCH の AuthZ/resource/action と fail-close rate limit が文書で明示される
  - [ ] required reject log fields が runbook に入る
- Validation:
  - doc diff review

### M3: 全体検証と review gate を通す
- Acceptance criteria:
  - [ ] `make rust-lint` が通る
  - [ ] `make validate` が通る
  - [ ] reviewer gate に blocking finding がない
- Validation:
  - `make rust-lint`
  - `make validate`
