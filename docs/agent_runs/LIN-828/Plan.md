# Plan

## Rules
- Stop-and-fix: validation が落ちたら次へ進まず修正する。

## Milestones
### M1: WS contract と realtime hub の設計を更新
- Acceptance criteria:
  - [ ] `message.updated` / `message.deleted` frame を additive に追加
  - [ ] realtime hub に edit/delete fanout API を追加
- Validation:
  - `cd rust && cargo test -p linklynx_protocol_ws`
  - `cd rust && cargo test -p linklynx_backend ws_message_ -- --ignored --nocapture`

### M2: HTTP edit/delete 成功時の fanout を接続
- Acceptance criteria:
  - [ ] edit/delete handler が成功時に realtime hub を呼ぶ
  - [ ] WS frame の snapshot が edit/delete response と一致する
- Validation:
  - `cd rust && cargo test -p linklynx_backend message_scylla_integration_http_ -- --nocapture`
  - `make message-scylla-integration`

### M3: runbook / evidence を整える
- Acceptance criteria:
  - [ ] runbook に WS edit/delete baseline を追加
  - [ ] Documentation.md に decisions と validation を記録
- Validation:
  - `make rust-lint`
