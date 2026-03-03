# LIN-804 Documentation Log

## Current status
- Now: 実装完了（ローカル検証・レビューゲート実施済み）
- Next: PR作成と説明記載

## Decisions
- API path: `GET/PATCH /users/me/profile`
- validation policy:
  - `display_name`: trim後 1..32
  - `status_text`: trim後空文字は `null` 化、上限 190 (Unicode scalar count)
  - `avatar_key`: trim後空文字は `null` 化、上限 512、`[A-Za-z0-9/_\-.]+`
- empty patch payload は `VALIDATION_ERROR`
- `display_name: null` は `VALIDATION_ERROR` で拒否（未指定とは区別）

## How to run / demo
- API runtime smoke:
  1. `cd rust && FIREBASE_PROJECT_ID=test-project DATABASE_URL=postgres://postgres:password@localhost:5432/linklynx AUTH_ALLOW_POSTGRES_NOTLS=true cargo run -p linklynx_backend`
  2. `curl -i -sS http://127.0.0.1:8080/health`
  3. `curl -i -sS http://127.0.0.1:8080/users/me/profile`（未認証のため `401 AUTH_MISSING_TOKEN`）

## Applied work
- Added profile API module:
  - `rust/apps/api/src/profile.rs`
  - `rust/apps/api/src/profile/errors.rs`
  - `rust/apps/api/src/profile/service.rs`
  - `rust/apps/api/src/profile/postgres.rs`
  - `rust/apps/api/src/profile/runtime.rs`
  - `rust/apps/api/src/profile/tests.rs`
- Wired runtime state with `profile_service` in `rust/apps/api/src/main.rs`.
- Added endpoints in `rust/apps/api/src/main/http_routes.rs`:
  - `GET /users/me/profile`
  - `PATCH /users/me/profile`
- Added request parsing contract fixes:
  - explicit `display_name: null` reject (`VALIDATION_ERROR`)
  - nullable string fields (`status_text`, `avatar_key`) preserve null/empty clear semantics.
- Added route tests in `rust/apps/api/src/main/tests.rs`:
  - success / validation / not found / dependency unavailable mappings.

## Validation results
- `cd rust && cargo test -p linklynx_backend --locked profile::tests`: passed.
- `cd rust && cargo test -p linklynx_backend --locked my_profile`: passed.
- `make rust-lint`: passed.
- `make validate`: failed (TypeScript test runtime environment issue).
  - Failure detail: `vitest` unhandled `ERR_REQUIRE_ESM` in `html-encoding-sniffer` (`@exodus/bytes/encoding-lite.js`) under current Node `v22.4.0`.
  - This is environment/dependency-side and not caused by LIN-804 Rust changes.
- `cd typescript && npm run typecheck`: passed.

## Review gate results
- `reviewer_ui_guard`: pass (`run_ui_checks: false`, backend-only diff).
- `reviewer_ui`: skipped (UI diffなし).
- `reviewer`:
  - 指摘1（`display_name: null` が未指定扱い）: fixed.
  - 指摘3（`PROFILE_UNAVAILABLE` 契約テスト不足）: fixed.
  - 指摘2（NoTLS経路）: existing project-wide runtime policyと同一でLIN-804スコープ外のため未変更。

## Runtime smoke
- Existing port occupier (`linklynx_backend`) was stopped to run fresh binary.
- Fresh startup confirmed:
  - `GET /health` => `200 OK`
  - `GET /users/me/profile` (no token) => `401 AUTH_MISSING_TOKEN`
