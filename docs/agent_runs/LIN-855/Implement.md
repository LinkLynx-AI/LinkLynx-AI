# LIN-855 Implement Rules

- Plan.md の順序で実装し、順序変更時は Documentation.md に理由を記録する。
- 変更は TypeScript フロントエンド認証導線に限定する。
- FSD 責務分離を維持する。
  - `entities/auth`: Firebase 呼び出し境界とエラー正規化
  - `features/auth-flow`: エラーメッセージ変換と UI 操作
  - `app/(auth)`: 画面合成（今回は原則変更不要）
- token を `localStorage/sessionStorage` に保存する変更は禁止。
- 既存メール/パスワード導線を壊さない。
- マイルストンごとに検証を行い、失敗時は即時修正する。
