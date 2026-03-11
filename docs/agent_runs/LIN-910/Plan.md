# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: validation が落ちたら次へ進む前に修正する。

## Milestones
### M1: Run artifact と profile 同期方針を固定する
- Acceptance criteria:
  - [ ] `LIN-910` 用 artifact を作成する。
  - [ ] frontend の source of truth を `auth-store + myProfile query` に統一する。
- Validation:
  - `git status --short`

### M2: 認証直後の profile hydration を実装する
- Acceptance criteria:
  - [ ] `AuthBridge` が認証済みユーザーの最小情報を投入できる。
  - [ ] `myProfile` 成功時に display name / status が `auth-store` に同期される。
  - [ ] fetch 失敗時に UI 全体が壊れない。
- Validation:
  - `cd typescript && npm run test -- src/app/providers/auth-bridge.test.tsx`

### M3: 保存成功時の cache / store 反映を実装する
- Acceptance criteria:
  - [ ] `useUpdateMyProfile` が `myProfile`, `friends`, `members`, `auth-store` を同期更新する。
  - [ ] `UserProfile` から同期責務を helper 側へ寄せる。
- Validation:
  - `cd typescript && npm run test -- src/shared/api/mutations/use-my-profile.test.ts src/features/settings/ui/user/user-profile.test.tsx`

### M4: 横断 validation と review を完了する
- Acceptance criteria:
  - [ ] required validation が通る。
  - [ ] reviewer / ui gate の結果を記録する。
- Validation:
  - `cd typescript && npm run typecheck`
  - `make validate`
