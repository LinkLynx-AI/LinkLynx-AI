# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: validation fails must be repaired before moving to the next step.
- Start mode: child issue start (`LIN-885` under `LIN-794`).
- Branch: `codex/lin-885`.

## Milestones
### M1: settings route 導線を実装する
- Acceptance criteria:
  - [x] 歯車ボタンが `/settings/profile` を開く。
  - [x] `/settings/profile` と `/settings/appearance` が route として表示できる。
  - [x] close / ESC が `returnTo` 経由で元の protected route へ戻る。
- Validation:
  - `cd typescript && npm run typecheck`

### M2: LIN-885 の回帰テストを追加する
- Acceptance criteria:
  - [x] routes の builder / `returnTo` 正規化を検証できる。
  - [x] ユーザーパネル歯車リンクの遷移先を検証できる。
  - [x] settings route shell の close / tab 遷移を検証できる。
- Validation:
  - `cd typescript && npm run test -- src/shared/config/routes.test.ts src/widgets/channel-sidebar/ui/user-panel.test.tsx src/app/settings/_components/settings-route-shell.test.tsx`

### M3: 品質ゲートとレビュー観点を通す
- Acceptance criteria:
  - [x] `cd typescript && npm run typecheck` が通る。
  - [x] `make validate` が通る。
  - [x] 必要な review 観点を確認し、ブロッカーが解消されている。
- Validation:
  - `cd typescript && npm run typecheck`
  - `make validate`
