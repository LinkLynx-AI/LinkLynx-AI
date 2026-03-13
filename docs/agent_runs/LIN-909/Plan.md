# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: validation failure は次へ進む前に修正する。

## Milestones
### M1: profile media 保存フローを実装
- Acceptance criteria:
  - [ ] settings profile で crop 後の avatar / banner を保存できる
  - [ ] save 時に signed upload と profile patch が順に呼ばれる
- Validation:
  - `cd typescript && npm run test -- src/features/settings/ui/user/user-profile.test.tsx`

### M2: 同期と再読込復元を実装
- Acceptance criteria:
  - [ ] avatar が auth-store / relevant caches へ反映される
  - [ ] 認証後 hydration で persisted avatar key から表示復元できる
- Validation:
  - `cd typescript && npm run test -- src/shared/api/mutations/use-my-profile.test.ts src/app/providers/auth-bridge.test.tsx`

### M3: 仕上げ検証
- Acceptance criteria:
  - [ ] typecheck / validate が通る
  - [ ] run memory が更新されている
- Validation:
  - `cd typescript && npm run typecheck`
  - `make validate`
