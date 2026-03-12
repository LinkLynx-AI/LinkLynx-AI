# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: validation fails must be repaired before moving to the next step.
- Start mode: child issue start (`LIN-933` under `LIN-899`).
- Branch: `codex/lin933`.

## Milestones
### M1: theme runtime と同期経路を整備する
- Acceptance criteria:
  - [ ] `next-themes` で root class を light/dark 切替できる。
  - [ ] profile 同期と mutation 成功時に theme が settings store と root theme へ反映される。
  - [ ] 保護画面の Discord token が light/dark 両対応になる。
- Validation:
  - `cd typescript && npm run test -- src/app/providers/auth-bridge.test.tsx src/shared/api/mutations/use-my-profile.test.ts`
  - `cd typescript && npm run typecheck`

### M2: appearance 画面から保存できるようにする
- Acceptance criteria:
  - [ ] `UserAppearance` が backend 契約どおり `dark/light` のみ扱う。
  - [ ] query 結果から初期 hydrate し、theme-only 保存ができる。
  - [ ] 保存成功/失敗と未保存状態が UI で分かる。
- Validation:
  - `cd typescript && npm run test -- src/features/settings/ui/user/user-appearance.test.tsx`
  - `cd typescript && npm run typecheck`

### M3: 回帰確認と品質ゲートを通す
- Acceptance criteria:
  - [ ] 関連ユニットテストが通る。
  - [ ] `make validate` が通る。
  - [ ] `LIN-933` の判断・検証結果が Documentation に残る。
- Validation:
  - `cd typescript && npm run test -- src/features/settings/ui/user/user-appearance.test.tsx src/app/providers/settings-theme-bridge.test.tsx src/app/providers/auth-bridge.test.tsx src/shared/api/mutations/use-my-profile.test.ts`
  - `cd typescript && npm run typecheck`
  - `make validate`
