# LIN-854 Plan

## Milestones
1. principal確保API/型を `entities/auth` に追加。
2. `features/auth-flow` に principal確保失敗の表示変換を追加。
3. register/login/verify-email から principal確保APIを呼ぶよう接続。
4. TypeScriptテスト（API + 文言変換）を追加。
5. Rust APIテスト（再試行/同時リクエスト冪等性）を追加。
6. 品質ゲートを実行し、証跡を `Documentation.md` に記録。

## Validation commands
- `cd typescript && npm run typecheck`
- `cd typescript && npm run test`
- `cd rust && cargo test -p linklynx_backend --locked`
- `make validate`

## Acceptance checks
- 新規登録・ログイン・メール確認完了導線で principal自動作成が実行される。
- `AUTH_*` 系返却がフロントで分類され、失敗時に原因追跡可能（request_id付き）となる。
- 同一UIDの再試行/同時処理で `principal_id` が一貫して重複作成されない。
