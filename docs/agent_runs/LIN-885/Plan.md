# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: if validation fails, repair it before moving to the next step.

## Milestones
### M1: 通常導線でユーザー設定 modal を開けるようにする
- Acceptance criteria:
  - [x] `UserPanel` の歯車ボタンが `user-settings` modal を開く。
  - [x] DM 画面とサーバーチャンネル画面の両方で同一導線が機能する。
- Validation:
  - `cd typescript && npm run test -- src/widgets/channel-sidebar/ui/user-panel.test.tsx`

### M2: プロフィール到達性と既存導線の回帰を固定する
- Acceptance criteria:
  - [x] ユーザー設定 modal からプロフィールタブへ到達できるテストがある。
  - [x] サーバー設定導線の既存挙動に退行がない。
- Validation:
  - `cd typescript && npm run test -- src/widgets/channel-sidebar/ui/user-panel.test.tsx src/features/settings/ui/settings-layout.test.tsx src/features/context-menus/ui/server-context-menu.test.tsx`

### M3: 品質ゲートとレビュー証跡を揃える
- Acceptance criteria:
  - [x] TypeScript の型検査と repo validation が通る。
  - [x] reviewer / UI gate / runtime smoke の結果を記録する。
- Validation:
  - `cd typescript && npm run typecheck`
  - `make rust-lint`
  - `make validate`
