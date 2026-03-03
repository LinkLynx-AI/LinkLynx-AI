# LIN-856 Plan

## Rules
- Validation が失敗した場合は次工程へ進まず修正する。
- LIN-856 スコープ外改修を混ぜない。

## Milestones
### M1: verify-email パネルへ自動確認ロジックを追加
- Acceptance criteria:
  - [x] `reloadCurrentAuthUser` の 5秒ポーリングを追加。
  - [x] focus / visibilitychange による即時再確認を追加。
  - [x] 5分上限到達時の停止条件とフォールバック通知を追加。
  - [x] 手動更新ボタンのフォールバック導線を維持。
- Validation:
  - `cd typescript && npm run typecheck`

### M2: UI テストを追加
- Acceptance criteria:
  - [x] 自動ポーリング、即時再確認、エラー継続、タイムアウト停止、手動フォールバックをテストで検証。
- Validation:
  - `cd typescript && npm run test -- src/features/auth-flow/ui/verify-email-panel.test.tsx`

### M3: 統合検証・証跡更新
- Acceptance criteria:
  - [ ] TypeScript 全体テストを通過。
  - [ ] `make validate` を通過。
  - [x] runtime smoke 結果（または実施不能理由）を記録。
  - [x] review gate 結果（またはフォールバック）を記録。
- Validation:
  - `cd typescript && npm run test`
  - `make validate`
