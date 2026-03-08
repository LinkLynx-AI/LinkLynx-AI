# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: validation fails must be repaired before moving forward.
- Start mode: child issue start (`LIN-937` under `LIN-935`).
- Branch: `codex/lin-937` (implementation is for the blocker issue only; no parent-scope mixing).

## Milestones
### M1: message domain / usecase を追加する
- Acceptance criteria:
  - [x] list / create command が trait 経由で実行できる。
  - [x] validation / dependency error が transport 再利用可能な形で返る。
- Validation:
  - `cd rust && CARGO_TARGET_DIR=/tmp/lin892-check cargo test -p linklynx_message_domain -- --nocapture`

### M2: Scylla / Postgres adapter と runtime wiring を追加する
- Acceptance criteria:
  - [x] Scylla append/list adapter が compile する。
  - [x] Postgres metadata repository が compile する。
  - [x] `apps/api` が runtime service を構築できる。
- Validation:
  - `cd rust && CARGO_TARGET_DIR=/tmp/lin892-check cargo check -p linklynx_backend`
  - `cd rust && CARGO_TARGET_DIR=/tmp/lin892-check cargo test -p linklynx_scylla_message -- --nocapture`
  - `cd rust && CARGO_TARGET_DIR=/tmp/lin892-check cargo test -p linklynx_postgres_message -- --nocapture`

### M3: repo gate を通す
- Acceptance criteria:
  - [x] `make rust-lint` が通る。
  - [ ] `make validate` が通る。
  - [x] frontend typecheck が通る。
- Validation:
  - `make rust-lint`
  - `make validate`
  - `cd typescript && npm run typecheck`
