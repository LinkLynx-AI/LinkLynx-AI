# Documentation

## Current status
- Done: guild message の REST/WS/event 契約を shared Rust crate へ固定し、apps/api の message endpoint / WS handler をその契約参照へ差し替えた。
- Done: runbook の paging/order/event class 記述を ADR / LIN-288 契約へ整合させた。
- Done: 検証とレビューを実行し、LIN-821 のスコープ内で追加修正は不要な状態まで確認した。

## Decisions
- 履歴 cursor の公開 I/F は `before` / `after` とし、値は opaque string に固定する。
- WS は `message.subscribe` / `message.unsubscribe` / `message.subscribed` / `message.unsubscribed` / `message.created` の最小契約に限定する。
- durable event の catalog 名は `message_create`、payload `type` は既存 runtime contract に合わせて `MessageCreated` とする。

## How to run / demo
- `cd rust && cargo test -p linklynx_message_api -p linklynx_protocol_ws -p linklynx_protocol_events`
- `cd rust && cargo test -p linklynx_backend create_channel_message`
- `make rust-lint`
- `cd typescript && npm run typecheck`
- `make validate`

## Validation evidence
- `cd rust && cargo test -p linklynx_message_api -p linklynx_protocol_ws -p linklynx_protocol_events`: pass
- `cd rust && cargo test -p linklynx_backend list_channel_messages`: pass
- `cd rust && cargo test -p linklynx_backend create_channel_message`: pass
- `make rust-lint`: pass
- `cd typescript && npm run typecheck`: pass
- `make validate`: pass
- `make rust-lint` と `make validate` は sandbox だと既存 AuthZ/SpiceDB テストの loopback bind が拒否されたため、権限付きで再実行して通過を確認した。
- TypeScript 側は `pnpm install --frozen-lockfile` 実行後に `npm run typecheck` / `make validate` を通し、依存未導入に起因する false negative を解消した。

## Review evidence
- unified review: no blocking findings
- UI impact: なし。backend Rust / docs のみの差分のため UI review は skip
- runtime smoke: skip。今回の差分は contract crate / fixture-backed endpoint / runbook 更新に閉じており、実データ接続や UI フロー追加は含まないため、既存の自動テストを実行根拠とした。

## Notes
- レビュー中に `create_channel_message_rejects_blank_content` が malformed JSON を送っており、blank content の validation 経路を直接検証していないことを確認したため修正した。
- malformed JSON は別テストへ分離し、JSON 解析失敗と business validation の両方を固定した。

## Known issues / follow-ups
- LIN-823 で Scylla 実データへ接続するまで、message REST は contract fixture ベースの最小実装。
- LIN-826 で購読状態管理と `message.created` fanout 実装を追加する。
