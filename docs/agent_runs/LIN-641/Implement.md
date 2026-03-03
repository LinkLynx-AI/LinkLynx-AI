# LIN-641 Implement Rules

- Plan.md のマイルストン順に実施し、順序変更時は Documentation.md に理由を残す。
- 変更は TypeScript フロントエンド認証導線に限定する。
- FSD の責務分離を維持する。
  - `entities/auth`: Firebase 呼び出し境界と型
  - `features/auth-flow`: 入力検証と画面操作
  - `app/(auth)`: 画面合成
- token を `localStorage/sessionStorage` に保存する変更は禁止。
- 主要 Firebase エラーは画面文言へ変換し、`unknown` へ丸め込みを許容する。
- 各マイルストン後に検証を実行し、失敗時は先に修正する。
