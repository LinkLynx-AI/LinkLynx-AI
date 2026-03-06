# LIN-854 Prompt

## Goal
- Firebase新規登録/ログイン/メール確認後の導線で、`/v1/protected/ping` を通じて principal 自動作成導線を必ず実行する。
- 初回認証時に `users` と `auth_identities` が作成されることを、フロント + API の統合観点で担保する。
- 失敗時に原因分類可能なエラー情報（request_id含む）を保持し、運用時に追跡できる状態にする。

## Non-goals
- LIN-642 の `authenticatedFetch` 汎用化や保護ルートリダイレクト実装。
- DBスキーマ変更。
- AuthZ仕様変更。

## Deliverables
- `entities/auth` に principal確保API (`ensurePrincipalProvisionedForCurrentUser`) と関連型を追加。
- `features/auth-flow` で principal確保失敗メッセージ変換を追加。
- `register/login/verify-email` の各導線を principal確保に接続。
- TypeScript/Rust の回帰テスト追加。

## Done conditions
- 登録・ログイン・メール確認完了導線で principal確保APIが呼ばれる。
- principal確保失敗時に遷移せず、分類済みメッセージを表示する。
- Rust APIテストで同一ユーザーの再試行・同時リクエストが冪等に収束する。
