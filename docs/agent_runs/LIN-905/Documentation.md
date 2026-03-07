# LIN-905 Documentation Log

## Current status
- Now: 検証・runtime smoke・review fallback まで完了
- Next: PR 用の根拠を整えて commit / PR 作成へ進む

## Decisions
- `LIN-905` は新規機能追加ではなく、既に `main` へ入った認証導線を leaf issue として締め直すタスクとして扱う。
- 受け入れ条件の引継ぎ元は `LIN-641` / `LIN-642` / `LIN-643` / `LIN-644` / `LIN-854` / `LIN-855` とする。
- verify/reset は `LIN-906`、認証 E2E と運用手順は `LIN-907` に残す。
- `make validate` は初回 Python 開発環境未整備で失敗したため、`python/.venv` を repo 既定の `make -C python setup` で作成して再実行した。
- runtime smoke は route-level / auth-boundary-level に限定し、実 Firebase 資格情報を使うログイン完了までは自動化しない。

## Inherited evidence
- `LIN-641`: login/register/verify-email/password-reset を Firebase 実処理へ接続
- `LIN-642`: `/protected/ping` ベースの保護導線、`returnTo` 付き login 復帰
- `LIN-643`: backend `POST /auth/ws-ticket` と `/ws + auth.identify`
- `LIN-644`: frontend ws ticket -> identify bridge
- `LIN-854`: principal provisioning を auth 導線へ接続
- `LIN-855`: login/register での Google 認証導線

## Acceptance mapping
- ログイン後に保護画面へ進める:
  - `typescript/src/features/auth-flow/ui/login-form.tsx`
  - `typescript/src/features/route-guard/ui/protected-preview-gate.tsx`
- 認証済み導線が一貫している:
  - `typescript/src/entities/auth/api/authenticated-fetch.ts`
  - `typescript/src/entities/auth/api/principal-provisioning.ts`
  - `typescript/src/app/providers/ws-auth-bridge.tsx`
  - `rust/apps/api/src/main/http_routes.rs`
  - `rust/apps/api/src/main/ws_routes.rs`

## How to run / demo
- `make validate`
- `make rust-lint`
- `cd typescript && npm run typecheck`
- `make dev`
- `curl http://127.0.0.1:3000/login`
- `curl http://127.0.0.1:8080/health`
- `curl http://127.0.0.1:8080/protected/ping`
- `curl -X POST http://127.0.0.1:8080/auth/ws-ticket`

## Validation results
- `cd typescript && npm run typecheck`: passed
- `cd typescript && npm run test -- src/entities/auth/api/authenticated-fetch.test.ts src/entities/auth/api/principal-provisioning.test.ts src/features/route-guard/ui/protected-preview-gate.test.tsx src/features/route-guard/ui/protected-preview-gate.browser.test.tsx src/features/route-guard/ui/route-guard-screen.test.tsx src/features/auth-flow/model/route-builder.test.ts src/app/providers/ws-auth-bridge.test.tsx src/entities/auth/api/ws-ticket.test.ts`: passed (8 files, 42 tests)
- `make rust-lint`: passed
- `make validate`: passed
- `cd typescript && npm run test`: passed via `make validate` (39 files, 193 tests)
- Note: Vitest 実行中に既存テストの `console.error` / `act(...)` warning は出るが、失敗にはならず既知の既存挙動として扱う。

## Review results
- manual self-review fallback: 実施（blocking issue なし）
- reviewer sub-agent orchestration: このセッションでは安定せず、docs-only diff のため manual fallback を採用
- UI gate: docs-only diff のため skip

## Per-issue evidence
- issue: `LIN-905`
- branch: `codex/LIN-905-login-protected-session-foundation`
- start mode: `child issue start`
- validation commands: passed
- reviewer gate: manual self-review fallback
- UI gate: skipped
- runtime smoke: passed
- PR: pending
- PR base branch: `main`

## Runtime smoke
- `make dev`: passed
- `GET /login`: `200`
- `/login` HTML に `Googleで続行` と `ログイン` を確認
- `GET /channels/me`: `200`
- `/channels/me` は shell HTML を返却し、client-side guard 導線の起点になることを確認
- `GET http://127.0.0.1:8080/health`: `200`, body `OK`
- `GET http://127.0.0.1:8080/protected/ping`: `401`, body `AUTH_MISSING_TOKEN`
- `POST http://127.0.0.1:8080/auth/ws-ticket`: `401`, body `AUTH_MISSING_TOKEN`
- Note: 認証済み login 完了から protected route / ws identify までの成立性は、引継ぎ元実装に加えて targeted tests (`protected-preview-gate`, `ws-auth-bridge`, `ws-ticket`, `principal-provisioning`) の通過で補強した。

## Known issues / follow-ups
- 初回セットアップでは `typescript/node_modules` と `python/.venv` が必要。
