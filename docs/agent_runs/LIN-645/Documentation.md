# Documentation.md (Status / audit log)

## Current status
- Now: smoke script / runbook / env 追加は完了。静的検証は通過済みで、runtime smoke は資格情報待ち。
- Next: `AUTH_SMOKE_EMAIL` / `AUTH_SMOKE_PASSWORD` を `typescript/.env.local` へ設定し、local runtime を起動して happy-path / dependency-unavailable を実行する。

## Decisions
- 最小E2Eは Playwright ではなく Node smoke script で実装する。
- 障害系は AuthZ dependency unavailable を対象にし、`503 / 1011` を確認する。
- token / ticket はログ出力しない。
- smoke script は test user の email も標準出力へ出さない。

## How to run / demo
- `cd typescript && npm run smoke:auth -- --mode=happy-path`
- `cd typescript && npm run smoke:auth -- --mode=dependency-unavailable`

## Validation results
- `node --check typescript/scripts/auth-e2e-smoke.mjs`: passed
- `cd typescript && npm run test -- scripts/auth-e2e-smoke.test.mjs`: passed
- `cd typescript && npm run typecheck`: passed
- `cd typescript && npm run test -- src/entities/auth/api/ws-ticket.test.ts src/entities/auth/api/principal-provisioning.test.ts src/app/providers/ws-auth-bridge.test.tsx`: passed
- `make validate`: passed
  - sandbox では Rust の SpiceDB / WS テストが `Operation not permitted` で失敗したため、権限昇格後に再実行して通過
- `make rust-lint`: passed
  - 同上。sandbox では同系統テストが権限不足で失敗したため、権限昇格後に再実行して通過

## Runtime smoke
- 未実施
- blocking condition:
  - Firebase login が `INVALID_LOGIN_CREDENTIALS` で失敗し、happy-path を完走できていない
- 現在確認できている前提:
  - `typescript/.env.local` の `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_FIREBASE_API_KEY` / `AUTH_SMOKE_EMAIL` / `AUTH_SMOKE_PASSWORD` は present
  - ルート `.env` の Firebase 系 env と `AUTH_ALLOW_POSTGRES_NOTLS` は present
  - Postgres は起動し、`database/postgres/migrations/*.up.sql` を全件適用済み
- attempt:
  - `npm run smoke:auth -- --mode=happy-path`: failed
  - result: `Firebase login failed: INVALID_LOGIN_CREDENTIALS.`
  - note: backend 自体は起動し、`AuthZ noop allow-all is active` まで確認済み

## Review results
- `reviewer`: pass
  - blocking finding なし
  - correctness reviewer の候補 1 件は source verification で棄却
- `reviewer_ui_guard`: `run_ui_checks=false`
  - changed paths は `typescript/scripts/**`, `typescript/package.json`, `typescript/.env.example`, `docs/runbooks/**`, `docs/agent_runs/LIN-645/**`
  - `typescript/src/**`, `typescript/public/**`, `typescript/next.config.ts`, `typescript/tailwind.config.ts` は未変更

## Known issues / follow-ups
- runtime smoke を完了するには `typescript/.env.local` の smoke 用資格情報と local backend/spicedb runtime が必要。
- `typescript` 依存は `npm -C typescript install --package-lock=false` で導入した。`npm ci` は `package-lock.json` と `package.json` の不整合で失敗したため使っていない。
