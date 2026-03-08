# LIN-906 Plan

## Rules
- `verify-email` の既存導線を壊さず、`password-reset` の不足だけを補う。
- 受け入れ条件に関係しない UI 調整は入れない。

## Milestones
### M1: 現状実装と受け入れ条件の差分を確定する
- Acceptance criteria:
  - [ ] `verify-email` の再送・更新・自動確認が既にあることを確認できる。
  - [ ] `password-reset` の再試行導線不足を特定できる。
  - [ ] 引継ぎ元 issue と現実装の対応を整理できる。
- Validation:
  - `rg -n "verify-email|password-reset|sendPasswordResetEmailByAddress|再試行" typescript docs/agent_runs`

### M2: password reset の再試行導線を実装してテストで固定する
- Acceptance criteria:
  - [ ] completion 後に再送導線が明示される。
  - [ ] 送信失敗時も列挙防止方針を守りつつ再試行できる。
  - [ ] コンポーネントテストで挙動を固定できる。
- Validation:
  - `cd typescript && npm run test -- src/features/auth-flow/ui/password-reset-form.test.tsx src/features/auth-flow/ui/verify-email-panel.test.tsx src/entities/auth/api/firebase-auth-actions.test.ts src/features/auth-flow/model/error-message.test.ts src/features/auth-flow/model/validation.test.ts`

### M3: 品質ゲートと runtime smoke を記録する
- Acceptance criteria:
  - [ ] `make validate` と `cd typescript && npm run typecheck` の結果を記録できる。
  - [ ] `verify-email` / `password-reset` の route-level smoke を記録できる。
  - [ ] reviewer gate 結果を残せる。
- Validation:
  - `cd typescript && npm run typecheck`
  - `make validate`
  - `make dev`
