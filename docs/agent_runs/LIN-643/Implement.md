# LIN-643 Implement Log

## 実装方針
- WS認証は `ready` / `identifying` の2フェーズで明確に分離し、identify前のアプリpayloadを常に拒否する。
- ws-ticket はハッシュキーで保存し、consume時に active -> consumed へ移して replay を拒否する。
- レート制限は v1前提のインメモリ固定窓（per-principal / per-origin）で導入する。
- `auth.reauthenticate` payloadは `d.idToken` のみ受理する。

## 変更対象
- Rust runtime/config:
  - `rust/Cargo.toml`
  - `rust/apps/api/Cargo.toml`
  - `rust/apps/api/src/main.rs`
- Auth module:
  - `rust/apps/api/src/auth.rs`
  - `rust/apps/api/src/auth/runtime.rs`
  - `rust/apps/api/src/auth/ws_ticket.rs` (new)
  - `rust/apps/api/src/auth/tests.rs`
- HTTP/WS routes:
  - `rust/apps/api/src/main/http_routes.rs`
  - `rust/apps/api/src/main/ws_routes.rs`
  - `rust/apps/api/src/main/tests.rs`
- Env/docs:
  - `.env.example`
  - `rust/.env.example`
  - `docker-compose.yml`

## 検証
- `make rust-lint`: passed
- `make validate`: failed（TypeScriptテスト段で Node 22.4 / ESM要件不一致由来の既知環境エラー）
