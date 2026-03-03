# Plan

## Rules
- validation/review で失敗したら次に進まず修正する。

## Milestones
### M1: Backend auth hardening
- Acceptance criteria:
  - [x] `AUTHZ_PROVIDER` 未設定/不正/未実装時に allow-all へ落ちない。
  - [x] auth metrics エンドポイントが認証保護される。
- Validation:
  - `cd rust && cargo test -p linklynx_backend`

### M2: Frontend auth consistency
- Acceptance criteria:
  - [x] AuthBridge が未認証遷移時に stale user を残さない。
  - [x] principal provisioning が `token-unavailable` を正しく扱う。
- Validation:
  - `cd typescript && npm run test -- src/entities/auth/api/principal-provisioning.test.ts src/features/auth-flow/model/error-message.test.ts`

### M3: Route guard regression tests
- Acceptance criteria:
  - [x] route guard の 401/403/503 分岐をカバーするテストが追加される。
- Validation:
  - `cd typescript && npm run test -- src/features/route-guard/ui/protected-preview-gate.test.tsx src/features/route-guard/ui/protected-preview-gate.browser.test.tsx src/app/providers/auth-bridge.test.tsx`

### M4: Review loop
- Acceptance criteria:
  - [x] `reviewer` 再実行で blocking finding がない。
- Validation:
  - `reviewer`: gate=pass（P1以上なし）
