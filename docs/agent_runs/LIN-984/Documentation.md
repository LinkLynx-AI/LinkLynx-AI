# Documentation

## Current status
- Now: dedicated internal guard 実装、docs 更新、targeted test と runtime smoke まで完了。
- Next: reviewer gate を確認し、必要なら指摘を反映する。

## Decisions
- internal endpoint は bearer token の protected route ではなく、shared secret を使う運用専用境界へ移す。
- `AUTHZ_PROVIDER=noop` や `RestPath + can_view` に依存する認可経路から internal endpoint を切り離す。
- internal metrics / invalidate の access audit は `request_id` / `caller_boundary` / `outcome` を最小ログ項目として残す。

## How to run / demo
- `cd rust && cargo test -p linklynx_backend internal_`
- `FIREBASE_PROJECT_ID=test-project DATABASE_URL=postgres://localhost/test AUTH_ALLOW_POSTGRES_NOTLS=true INTERNAL_OPS_SHARED_SECRET=smoke-secret cargo run -p linklynx_backend`
- `curl -H 'x-linklynx-internal-shared-secret: smoke-secret' http://127.0.0.1:8080/internal/auth/metrics`
- `curl http://127.0.0.1:8080/internal/authz/metrics`
- `make validate`
- `make rust-lint`
- `cd typescript && npm run typecheck`

## Known issues / follow-ups
- runtime で internal endpoint を使う caller は `INTERNAL_OPS_SHARED_SECRET` と `x-linklynx-internal-shared-secret` の両方を合わせる必要がある。

## Validation log
- `cd rust && cargo test -p linklynx_backend internal_ -- --nocapture`
  - pass
  - internal metrics / authz metrics / cache invalidate の dedicated guard 回帰テスト 9件が通過
- `cargo test -p linklynx_backend rest_authz_action_maps_invite_and_message_commands -- --nocapture`
  - pass
- `make rust-lint`
  - pass
  - `cargo fmt --check` と `cargo clippy --workspace --all-targets --all-features -D warnings` を含めて通過
- `git diff --check`
  - pass
- `make validate`
  - fail
  - `typescript/` で `prettier` が見つからず停止。`node_modules` 未配置の環境起因
- `cd typescript && npm run typecheck`
  - fail
  - `tsc` が見つからず停止。`node_modules` 未配置の環境起因

## Review gate
- pending

## Runtime smoke
- pass
- command:
  - `FIREBASE_PROJECT_ID=test-project DATABASE_URL=postgres://localhost/test AUTH_ALLOW_POSTGRES_NOTLS=true INTERNAL_OPS_SHARED_SECRET=smoke-secret cargo run -p linklynx_backend`
  - `curl -H 'x-linklynx-internal-shared-secret: smoke-secret' http://127.0.0.1:8080/internal/auth/metrics` -> `200`
  - `curl http://127.0.0.1:8080/internal/authz/metrics` -> `403`
- observed:
  - success path で auth metrics JSON を取得
  - missing secret path で `INTERNAL_OPS_FORBIDDEN`
