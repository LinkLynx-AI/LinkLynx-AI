# Plan

## Rules
- Stop-and-fix: 検証またはレビューで失敗したら次工程へ進まず修正する。
- Scope lock: `LIN-823` は guild message send/list API とその検証に限定し、DM / WS publish / edit / delete は触らない。
- Start mode: `child issue start`
- Branch: `codex/lin-823`

## Milestones
### M1: run memory と shared helper を整備する
- Acceptance criteria:
  - [x] `docs/agent_runs/LIN-823/` の 4 ファイルを作成
  - [x] message integration helper を shared test utility として切り出す
- Validation:
  - `cd rust && cargo test -p linklynx_backend message_scylla_integration_ -- --list`

### M2: HTTP live integration を追加する
- Acceptance criteria:
  - [x] create -> list の HTTP round-trip を live DB/Scylla で固定
  - [x] bucket boundary paging を HTTP レベルで固定
  - [x] 公開 API 契約を変更しない
- Validation:
  - `make message-scylla-integration`
  - `cd rust && cargo test -p linklynx_backend list_channel_messages`
  - `cd rust && cargo test -p linklynx_backend create_channel_message`

### M3: 全体検証と review gate を通す
- Acceptance criteria:
  - [ ] `make rust-lint` が通る
  - [ ] `cd typescript && npm run typecheck` が通る
  - [ ] `make validate` が通る
  - [ ] `reviewer` の blocking 指摘がない
- Validation:
  - `make rust-lint`
  - `cd typescript && npm run typecheck`
  - `make validate`
