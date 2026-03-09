# Documentation

## Current status
- Now: message integration helper の共通化と HTTP live integration test の追加まで実装済み。
- Next: sandbox 外で不足している live validation と reviewer gate を再実行し、PR 証跡を閉じる。

## Decisions
- Start mode は `child issue start`。
- guild channel message の create/list に限定し、DM / WS publish は今回扱わない。
- 既存 contract を維持し、HTTP live integration を一次証跡にする。
- `make message-scylla-integration` の既存 filter に乗せるため、新規 HTTP live test 名も `message_scylla_integration_` 接頭辞に揃える。
- integration helper は `rust/apps/api/src/message/test_support.rs` に集約し、service test と main HTTP test の両方で再利用する。
- PR review で上がった改善案のうち、issue scope を広げない範囲で `test_support.rs` の可読性改善のみ取り込む。test-only helper の panic / expect を Result 化する設計変更は今回は行わない。

## How to run / demo
- `make db-up`
- `make db-migrate`
- `make scylla-bootstrap`
- `make message-scylla-integration`
- `cd rust && cargo test -p linklynx_backend create_channel_message -- --nocapture`
- `cd rust && cargo test -p linklynx_backend list_channel_messages -- --nocapture`

## Validation evidence
- `cd rust && cargo test -p linklynx_backend message_scylla_integration_ --no-run`: pass
- `cd rust && cargo test -p linklynx_backend message_scylla_integration_ -- --nocapture`: pass
- `cd rust && cargo test -p linklynx_backend create_channel_message -- --nocapture`: pass
- `cd rust && cargo test -p linklynx_backend list_channel_messages -- --nocapture`: pass
- `cd rust && cargo test -p linklynx_backend -- --list | rg 'message_scylla_integration_http'`: pass
- `make rust-lint`: fail（sandbox が localhost bind/connect を拒否し、既存 AuthZ / WS テストが `Operation not permitted` で失敗）
- `cd typescript && npm run typecheck`: fail（`tsc: command not found`。`node_modules` 未導入）
- `make validate`: fail（`typescript` 側で `prettier: command not found`。`node_modules` 未導入）
- `MESSAGE_SCYLLA_INTEGRATION=true ... cargo test -p linklynx_backend message_scylla_integration_http_create_and_list_channel_messages_use_live_storage -- --nocapture`: fail（sandbox が localhost Postgres 接続を `Operation not permitted` で拒否）

## Review gate
- reviewer_simple: `gate: pass`。blocking finding なし。
- reviewer: 実行したが、このセッション中には結果回収前に interruption になった。
- reviewer_ui_guard: `run_ui_checks=false`。差分は `rust/apps/api/src/**` と `docs/agent_runs/LIN-823/**` のみで frontend UI 変更なし。
- Claude review comment: `950_000` の定数化と、Scylla table 名補間前に keyspace を検証している意図が読み取れるよう doc comment を補強。test-only helper の Result 化や SQL 組み立て全体の再設計は、validated identifier 前提かつ issue scope 外のため不採用。

## Runtime smoke
- 未実施。sandbox が localhost connect と Docker daemon への接続を拒否するため、`make db-up` / live runtime 起動の証跡はこの環境では取得不可。

## Known issues / follow-ups
- `make db-up` は Docker daemon socket へのアクセスが sandbox で拒否される。
- integration test を `MESSAGE_SCYLLA_INTEGRATION=true` 付きで強制実行すると、localhost 接続自体が sandbox に拒否される。
- TypeScript 側は依存未導入のため、`typecheck` / `validate` を再現するには package install 済み環境が必要。
