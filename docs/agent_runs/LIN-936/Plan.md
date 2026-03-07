# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: validation fails must be repaired before moving forward.
- Start mode: child issue start (`LIN-936` under `LIN-935`).
- Branch: `codex/lin-936`

## Milestones
### M1: Scylla runtime config と health reporter を追加する
- Acceptance criteria:
  - [x] runtime env contract が追加される。
  - [x] API startup で Scylla client 初期化を試行し、state に reporter を保持する。
  - [x] `/internal/scylla/health` が `ready | degraded | error` を返す。
- Validation:
  - `cd rust && cargo test -p linklynx_backend scylla_health -- --nocapture`
  - `cd rust && cargo test -p linklynx_backend main::tests::health -- --nocapture`

### M2: local bootstrap / verification 導線を追加する
- Acceptance criteria:
  - [x] `Makefile` から Scylla bootstrap を実行できる。
  - [x] compose runtime env と `.env.example` が揃う。
  - [x] runbook から local 再現手順を辿れる。
- Validation:
  - `make db-up`
  - `make scylla-bootstrap`

### M3: delivery gates を通す
- Acceptance criteria:
  - [x] `make rust-lint` が通る。
  - [x] `make validate` が通る。
  - [ ] required review gates が通る。
  - [x] runtime smoke 結果を記録する。
- Validation:
  - `make rust-lint`
  - `make validate`
