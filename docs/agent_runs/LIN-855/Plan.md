# LIN-855 Plan

## Rules
- Validation 失敗時は次のマイルストンへ進まず即修正する。
- LIN-855 のスコープ外改修を混ぜない。

## Milestones
### M1: Auth entity に Google popup API を追加
- Acceptance criteria:
  - [x] `signInWithGooglePopup` が `entities/auth` から公開される。
  - [x] Google popup 関連の Firebase エラーを型付きで正規化できる。
- Validation:
  - `cd typescript && npm run typecheck`
  - `cd typescript && npm run test -- src/entities/auth/api/firebase-auth-actions.test.ts`

### M2: auth-flow model/UI に Google 導線を追加
- Acceptance criteria:
  - [x] login/register に Google サインインボタンが追加される。
  - [x] Google 導線の失敗時に専用メッセージを表示できる。
  - [x] 既存 email/password 導線の分岐を維持する。
- Validation:
  - `cd typescript && npm run typecheck`
  - `cd typescript && npm run test -- src/features/auth-flow/model/error-message.test.ts`

### M3: 統合確認と証跡更新
- Acceptance criteria:
  - [x] 主要テストと品質ゲートが通過する。
  - [x] runtime smoke 実施結果（または実施不能理由）を記録する。
  - [x] review gate 実施結果を記録する。
- Validation:
  - `cd typescript && npm run test`
  - `make validate`
