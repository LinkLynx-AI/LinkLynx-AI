# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: if validation fails, repair it before moving to the next step.

## Milestones
### M1: Invite join contract と backend transaction を定義
- Acceptance criteria:
  - [x] endpoint path / request / response / error contract を決める。
  - [x] invite status 判定と membership 冪等処理の SQL 方針を決める。
- Validation:
  - `cargo test -p linklynx_backend invite`

### M2: Rust API 実装と回帰テスト
- Acceptance criteria:
  - [x] join endpoint が初回参加を成功させる。
  - [x] 重複参加が idempotent success に収束する。
  - [x] invalid / expired / maxed-out / disabled invite を reject する。
  - [x] unavailable path を fail-close する。
- Validation:
  - `cargo test -p linklynx_backend invite`
  - `cargo test -p linklynx_backend join`

### M3: Delivery evidence
- Acceptance criteria:
  - [x] ADR / AuthZ matrix / run memory を更新する。
  - [x] `make validate` と `make rust-lint` を通す。
  - [x] 実DB invite integration test をローカルで通し、CI 実行経路も追加する。
  - [x] PR evidence を作る。 (`https://github.com/LinkLynx-AI/LinkLynx-AI/pull/1133`)
- Validation:
  - `docker compose down -v && docker compose up -d postgres && ... && INVITE_POSTGRES_INTEGRATION=true cargo test -p linklynx_backend postgres_join_invite_integration_ -- --nocapture`
  - `make validate`
  - `make rust-lint`
