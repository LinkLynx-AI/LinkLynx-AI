# Plan.md

## Rules
- Stop-and-fix: validation や review で blocking issue が出たら次へ進む前に修正する。

## Milestones
### M1: message create outcome を publish 判定付きに拡張する
- Acceptance criteria:
  - [ ] create 結果から `should_publish` を判定できる
  - [ ] completed idempotency replay は `should_publish = false` になる
- Validation:
  - `cd rust && cargo test -p linklynx_message_domain create_reuses_completed_idempotency_key_without_append`
  - `cd rust && cargo test -p linklynx_backend create_channel_message_reuses_message_identity_for_same_idempotency_key`

### M2: WS subscription hub と fanout を接続する
- Acceptance criteria:
  - [ ] subscribe / unsubscribe が実際の購読状態に反映される
  - [ ] message create 成功時に購読中クライアントへ `message.created` が届く
  - [ ] disconnect 時に購読が cleanup される
- Validation:
  - `cd rust && cargo test -p linklynx_backend ws_message_created_fanout_reaches_all_subscribers`
  - `cd rust && cargo test -p linklynx_backend ws_message_created_fanout_skips_completed_idempotency_replay`

### M3: issue validation / review evidence を固める
- Acceptance criteria:
  - [ ] 必須 validation が通る
  - [ ] review gate 用の証跡を Documentation.md に残す
- Validation:
  - `make validate`
  - `make rust-lint`
  - `cd typescript && npm run typecheck`
