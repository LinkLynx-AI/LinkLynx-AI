# Documentation.md (Status / audit log)

## Current status
- Now: 実装完了。コード/ドキュメント差分と review 反映済みで、runtime smoke は環境待ち
- Next: smoke 用資格情報と backend/spicedb runtime を揃えて happy-path / dependency-unavailable を実行し、PR 用の実行証跡を確定する

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
- `cd typescript && npm run typecheck`: passed
- `cd typescript && npm run test -- scripts/auth-e2e-smoke.test.mjs`: passed
- `cd typescript && npm run test -- src/entities/auth/api/ws-ticket.test.ts src/entities/auth/api/principal-provisioning.test.ts src/app/providers/ws-auth-bridge.test.tsx`: passed
- `cd typescript && npm run test`: passed (34 files, 179 tests)
- `make rust-lint`: passed
  - sandbox 内では既存の Rust SpiceDB 系テストが `Operation not permitted` で失敗したため、権限昇格後に再実行して通過
- `make validate`: passed
  - 同上の sandbox 制約を回避するため、権限昇格後に再実行して通過

## Runtime smoke
- 未実施
- 理由:
  - `typescript/.env.local` に `AUTH_SMOKE_EMAIL` / `AUTH_SMOKE_PASSWORD` が未設定で、Firebase verified test user を使った login を実行できない
  - ローカル Docker では `postgres`, `scylladb` のみ起動中で、`rust` / `spicedb` の runtime smoke 前提が揃っていない

## Review results
- `reviewer`: timed out in this session
- `reviewer_simple`: pass
  - 指摘 2件は runbook 文言の精度のみで、`dependency-unavailable` の対象を AuthZ outage に限定し、SpiceDB runbook に別ターミナル実行を追記して解消
- `reviewer_ui_guard`: `run_ui_checks=false`
  - changed files are `typescript/scripts/**`, `typescript/package.json`, `typescript/.env.example`, `docs/**`
  - `typescript/src/**`, `public/**`, `tailwind.config.ts`, `next.config.ts` は未変更
- manual self-review:
  - smoke script は token / ticket / test user email を stdout へ出さない
  - `happy-path` で REST `principal_id` と WS `principalId` の整合を確認する
  - dependency-unavailable は `503 / AUTHZ_UNAVAILABLE` と `1011 / AUTHZ_UNAVAILABLE` を期待値に固定する

## Known issues / follow-ups
- reviewer 系の可用性は実行時に確認する。
- runtime smoke を完了するには `typescript/.env.local` へ smoke 用資格情報を追加し、`AUTHZ_PROVIDER=spicedb` で backend を起動したローカル環境が必要。
