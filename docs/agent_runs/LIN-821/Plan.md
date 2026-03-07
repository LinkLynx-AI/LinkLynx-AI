# Plan

## Rules
- Stop-and-fix: 検証またはレビューで失敗したら次工程へ進まず修正する。
- Scope lock: LIN-821 は contract fixation に限定し、Scylla / WS fanout 本体は触らない。

## Milestones
### M1: contract crate と memory 受け皿を追加
- Acceptance criteria:
  - [ ] `docs/agent_runs/LIN-821/` の 4 ファイルを作成
  - [ ] message API / WS / event contract crate を workspace へ追加
- Validation:
  - `cargo test -p linklynx_message_api -p linklynx_protocol_ws -p linklynx_protocol_events`

### M2: apps/api を shared contract 参照へ差し替え
- Acceptance criteria:
  - [ ] `/v1/guilds/{guild_id}/channels/{channel_id}/messages` が shared DTO を返す
  - [ ] WS で `message.subscribe` / `message.unsubscribe` ack を shared frame で返す
  - [ ] cursor validation / paging validation を API テストで固定
- Validation:
  - `cargo test -p linklynx_backend main::tests`

### M3: 文書整合と全体検証
- Acceptance criteria:
  - [ ] v1 message contract runbook を追加
  - [ ] history paging / realtime runbook の矛盾を解消
  - [ ] reviewer_simple まで回せる状態にする
- Validation:
  - `make validate`
  - `make rust-lint`
  - `cd typescript && npm run typecheck`
