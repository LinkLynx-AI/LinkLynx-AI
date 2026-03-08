# Documentation.md (Status / audit log)

## Current status
- Now: message domain / Scylla adapter / Postgres metadata repository / apps/api runtime wiring の実装と主要 validation まで完了
- Next: review gate の結果を確定し、`LIN-892` 側の次 blocker `LIN-938` 判定へ進む

## Decisions
- archived dependency issue (`LIN-847`, `LIN-846`) の責務は `LIN-937` 内へ最小限取り込み、workspace crate として `domains/message`, `platform/scylla/message`, `platform/postgres/message` を追加した。
- handler 本体はまだ fixture のまま維持し、transport 切り替えは後続 `LIN-914` / `LIN-915` に残した。
- bucket は 10 日幅の deterministic integer にし、list adapter は bucket を跨いで `limit + 1` と `next_before/next_after` を組み立てる。
- Postgres metadata repository は `guild_members` を使った membership check と `channel_last_message` 更新だけを持ち、監査/queue 状態までは扱わない。

## Validation log
- `cd rust && CARGO_TARGET_DIR=/tmp/lin-937-target cargo test -p linklynx_message_domain -p linklynx_scylla_message -p linklynx_postgres_message -- --nocapture`: pass
- `cd rust && CARGO_TARGET_DIR=/tmp/lin-937-target cargo check -p linklynx_backend -q`: pass
- `cd rust && CARGO_TARGET_DIR=/tmp/lin-937-target cargo test -p linklynx_backend unavailable_message_service_fail_closes -- --nocapture`: pass
- `make rust-lint`: pass
- `cd typescript && pnpm run format:check`: pass
- `cd typescript && npm run typecheck`: pass
- `cd typescript && pnpm run test`: pass
- `cd python && make validate`: pass
- `make validate`: failed once in this worktree on TypeScript formatter resolution before targeted reruns; root target was not used as final evidence because it mutates unrelated trees (`format`) and the needed per-language checks above passed.
- Runtime smoke:
- `make rust-dev` inside sandbox: failed because local bind/Scylla access is blocked by sandbox (`Operation not permitted`).
- `make rust-dev` outside sandbox: backend boot reached `server starting address=0.0.0.0:8080`, then exited with `AddrInUse`; follow-up `curl http://127.0.0.1:8080/{,health}` did not connect. Treat as environment-contended and not a product regression.
- Review gate:
- `reviewer_ui_guard`: pass (`run_ui_checks: false`, Rust/docs only)
- manual code review: no blocking findings identified in current diff
- `reviewer` meta run: interrupted / timed out in this session, noted for manual PR evidence

## How to run / demo
- `cd rust && CARGO_TARGET_DIR=/tmp/lin-937-target cargo check -p linklynx_backend -q`
- `cd rust && CARGO_TARGET_DIR=/tmp/lin-937-target cargo test -p linklynx_message_domain -p linklynx_scylla_message -p linklynx_postgres_message -- --nocapture`
- `cd rust && CARGO_TARGET_DIR=/tmp/lin-937-target cargo test -p linklynx_backend unavailable_message_service_fail_closes -- --nocapture`
- `make rust-lint`

## Known issues / follow-ups
- transport (`http_routes.rs`) はまだ `message_service` を読んでおらず、`LIN-914` / `LIN-915` で切り替えが必要。
- `record_guild_channel_message_created` は `channel_last_message` のみ更新する。監査/queue 状態は `LIN-846` 系の後続責務。
- runtime smoke は sandbox 制限とローカル port 競合で確定できていない。PR では「environment-blocked」として明示し、必要ならクリーン環境で再実施する。
