# Plan

## Rules
- Stop-and-fix: validation / review 失敗時は次工程へ進まず修正する。
- Scope lock: LIN-938 は Scylla integration test / CI / runbook に限定し、message feature の新規機能追加はしない。
- Start mode: child issue start (`LIN-938` under `LIN-935`).
- Branch: `codex/lin-938_2`

## Milestones
### M1: run memory と test strategy を固定する
- Acceptance criteria:
  - [ ] `docs/agent_runs/LIN-938/` の 4 ファイルを用意する
  - [ ] env-gated live integration の配置と filter 名を固定する
- Validation:
  - `cd rust && cargo test -p linklynx_backend message_scylla_integration_ -- --list`

### M2: message live integration tests を追加する
- Acceptance criteria:
  - [ ] duplicate no-op が実 Scylla で固定される
  - [ ] paging edge / bucket boundary が実 Scylla + Postgres context で固定される
  - [ ] unavailable fail-close が自動検知される
- Validation:
  - `cd rust && cargo test -p linklynx_backend message_scylla_integration_ -- --nocapture`

### M3: local / CI execution path を整備する
- Acceptance criteria:
  - [ ] `make message-scylla-integration` が追加される
  - [ ] GitHub Actions に Scylla integration 実行経路が追加される
  - [ ] runbook にローカル検証手順が追記される
- Validation:
  - `make message-scylla-integration`

### M4: 全体検証と review gate を通す
- Acceptance criteria:
  - [ ] `make rust-lint` が通る
  - [ ] `make validate` が通る
  - [ ] reviewer gate の blocking finding が解消される
- Validation:
  - `make rust-lint`
  - `make validate`
