# LIN-641 Plan

## Rules
- Validation で失敗した場合は次工程へ進む前に修正する。
- LIN-641 スコープ外（REST/WS 実ガード、認証外機能拡張）を混ぜない。

## Milestones
### M1: Auth entity API を追加
- Acceptance criteria:
  - [ ] Firebase 操作用 API（login/register/verify/reset/reload）が `entities/auth` から公開される。
  - [ ] Firebase エラーを型付きで正規化できる。
- Validation:
  - `cd typescript && npm run typecheck`
  - `cd typescript && npm run test -- src/entities/auth/api/firebase-auth-actions.test.ts`

### M2: Auth flow feature を追加
- Acceptance criteria:
  - [ ] login/register/verify/reset 用 client UI を `features/auth-flow` に実装。
  - [ ] 入力バリデーションとエラーメッセージ変換を model 層に分離。
- Validation:
  - `cd typescript && npm run typecheck`
  - `cd typescript && npm run test -- src/features/auth-flow/model/validation.test.ts src/features/auth-flow/model/error-message.test.ts`

### M3: app/(auth) 4画面へ接続
- Acceptance criteria:
  - [ ] 4ページがフォーム送信で Firebase 処理を呼び出す。
  - [ ] 未確認メール導線が `verify-email` へ遷移する。
  - [ ] reset は列挙防止方針の同一メッセージ表示になる。
- Validation:
  - `cd typescript && npm run typecheck`
  - `cd typescript && npm run test`
