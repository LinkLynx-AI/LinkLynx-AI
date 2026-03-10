# Documentation.md

## Current status
- Now: LIN-826 の実装・再修正・Rust validation は完了。
- Next: PR 説明へ reviewer 結果と sandbox 制約を転記する。

## Decisions
- WS fanout は現 issue では in-process hub に限定する。
- external WS frame / REST schema は変更しない。
- completed idempotency replay は `message.created` を再送しない。
- REST create 成功後の realtime fanout は best-effort とし、送達失敗で write path は失敗させない。
- realtime outbound queue は bounded にし、overflow 時は frame drop でメモリ増加を防ぐ。
- WS の購読 state は client header 由来 `request_id` ではなく、接続ごとの server-generated UUID session key で管理する。
- 権限剥奪後の stale subscription を防ぐため、購読ごとに `principal_id` を保持し、reauth 後と `message.created` publish 前に再認可する。
- REST create の latency を fanout で悪化させないため、publish は background task へ切り離す。
- sandbox で bind できない TCP 前提テストは silent skip をやめ、`#[ignore]` で明示し、代わりに bind-free の realtime 権限回帰テストを常時実行する。

## How to run / demo
- 2 本の WS client を同じ channel に subscribe する。
- `POST /v1/guilds/{guild_id}/channels/{channel_id}/messages` を 1 回呼ぶ。
- 両 client に同一 `message.created` snapshot が届くことを確認する。

## Validation evidence
- `cd rust && cargo test --workspace`: pass (`264 passed, 17 ignored`)
- `make rust-lint`: pass
- `cd rust && cargo fmt --all --check`: pass
- `cd rust && cargo clippy --workspace --all-targets --all-features -- -D warnings`: pass
- `cd typescript && npm run typecheck`: fail (`tsc: command not found`, `node_modules` 未導入)
- `make validate`: fail (`prettier: command not found`, `node_modules` 未導入)

## Review evidence
- reviewer: 既存 reviewer agent の最終結果は `No blocking findings`。residual risk は「sandbox が loopback/TCP bind を禁止するため、WS end-to-end fanout は ignored test 扱いで、bind-free test を主証跡にしている」こと。
- UI guard: `run_ui_checks=false` 相当。差分は Rust backend / docs のみで、UI 対象ファイル変更なし。
- runtime smoke: sandbox の TCP bind 制限により実 network smoke は未実施。代替として bind-free realtime 権限回帰テストと workspace test/lint を証跡にした。

## Known issues / follow-ups
- multi-instance realtime fanout や broker 連携は別 issue で扱う。
- sandbox では `TcpListener::bind("127.0.0.1:0")` を含む TCP listener を作れないため、SpiceDB mock server と WS socket end-to-end test は `#[ignore]` で明示した。
