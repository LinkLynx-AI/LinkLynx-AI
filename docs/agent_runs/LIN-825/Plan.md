# Plan

## Rules
- Stop-and-fix: 検証または review で失敗したら次工程へ進まない。
- Scope lock: `LIN-825` は command API に限定し、WS/FE は扱わない。
- Start mode: `child issue start`
- Branch: `codex/LIN-825-command-api`

## Milestones
### M1: run memory と command contract を追加する
- Acceptance criteria:
  - [ ] `docs/agent_runs/LIN-825/` の 4 ファイルを作成
  - [ ] edit/delete request/response 型を追加
  - [ ] conflict / authz denied の error contract を追加
- Validation:
  - `cd rust && cargo test -p linklynx_message_api`

### M2: backend command path を実装する
- Acceptance criteria:
  - [ ] usecase/service/store で edit/delete が動作する
  - [ ] expectedVersion 競合で `409`
  - [ ] tombstone が list/read 互換の snapshot として残る
- Validation:
  - `cd rust && cargo test -p linklynx_message_domain`
  - `cd rust && cargo test -p linklynx_platform_scylla_message`
  - `cd rust && cargo test -p linklynx_backend create_channel_message`

### M3: HTTP と全体検証を通す
- Acceptance criteria:
  - [ ] route test と integration test が通る
  - [ ] `make rust-lint` が通る
  - [ ] `cd typescript && npm run typecheck` が通る
  - [ ] `make validate` が通る
- Validation:
  - `cd rust && cargo test -p linklynx_backend edit_channel_message`
  - `cd rust && cargo test -p linklynx_backend delete_channel_message`
  - `make rust-lint`
  - `cd typescript && npm run typecheck`
  - `make validate`
