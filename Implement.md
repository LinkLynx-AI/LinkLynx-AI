# Implement

## 2026-03-04 server/guild Rust backend review run
- 必須参照を確認:
  - `references/core-policy.md`
  - `references/delivery-flow.md`
  - `references/review-gates.md`
  - `docs/RUST.md`
  - `docs/DATABASE.md`
  - `docs/adr/ADR-004-authz-fail-close-and-cache-strategy.md`
  - `docs/adr/ADR-005-dragonfly-ratelimit-failure-policy.md`
- Start mode: `standalone smallest-unit`（現在ブランチを使用）
- 対象スコープ: `rust/apps/api/src/guild_channel/*` + `rust/apps/api/src/main/http_routes.rs` 周辺

## レビュー/修正ループ
1. 初回レビュー
- `reviewer`: `gate: block`
- 主指摘:
  - `list_guild_channels` の認可判定と一覧取得が分離（TOCTOU）
  - `FOREIGN_KEY_VIOLATION` の一律 `guild_not_found` 変換
  - 入力境界テスト不足
- `reviewer_ui_guard`: `run_ui_checks: false`

2. 修正
- `rust/apps/api/src/guild_channel/postgres.rs`
  - `LIST_GUILD_CHANNELS_SQL` を追加し、membership 条件込みの単一SQLで一覧取得
  - 一覧0件時は `has_guild` で `403/404` を分岐し契約を維持
  - `guild_exists` -> `has_guild` にリネーム
  - `map_write_error` を制約名判定へ変更し、`channels_guild_id_fkey` のみ `guild_not_found`
- `rust/apps/api/src/guild_channel/tests.rs`
  - `LIST_GUILD_CHANNELS_SQL` の membership lookup 必須テストを追加
- `rust/apps/api/src/main/tests.rs`
  - `/guilds/abc/channels` の 400 検証
  - `/guilds/0/channels` の 400 検証
  - malformed JSON での channel 作成 400 検証

3. 検証
- `cd rust && cargo test -p linklynx_backend guild_channel` ✅
- `make validate` ✅

4. 再レビュー
- `reviewer`（差分ファイル限定）: `gate: pass` ✅
- `reviewer_ui_guard`: `run_ui_checks: false` ✅
