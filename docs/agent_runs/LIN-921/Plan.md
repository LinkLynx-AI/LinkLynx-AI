# LIN-921 Plan

## Rules
- Stop-and-fix: validation または review で blocking issue が出たら先へ進まない。
- Scope lock: DM 投稿・受信成立に必要な realtime/FE 接続に限定し、既読同期や DM edit/delete は扱わない。
- Start mode: `child issue start`
- Branch: `codex/lin921`

## Milestones
### M1: run memory と契約方針を固定する
- Acceptance criteria:
  - [ ] `docs/agent_runs/LIN-921/` の 4 ファイルを作成
  - [ ] DM realtime は guild 用 `message.*` を壊さない加算拡張で進める

### M2: backend DM realtime を実装する
- Acceptance criteria:
  - [ ] DM 用 WS frame を追加する
  - [ ] DM subscribe/unsubscribe と create publish を接続する
  - [ ] completed replay は再送しない

### M3: frontend DM route を realtime 接続する
- Acceptance criteria:
  - [ ] DM route で subscribe が送信される
  - [ ] `dm.message.created` を timeline cache へ反映できる
  - [ ] reconnect 後の履歴補償を維持する

### M4: 回帰テストと検証
- Acceptance criteria:
  - [ ] backend/frontend の回帰テストを追加・更新する
  - [ ] `make validate` と `cd typescript && npm run typecheck` を実行する
