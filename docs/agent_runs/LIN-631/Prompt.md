# LIN-631 Prompt

## Goal
- 現行 `main` の認証スキーマを基準に、設計資料との差分を1つの文書に整理する。
- `users.email_verified` / `users.password_hash` 廃止を現行仕様として明示する。
- `email_verification_tokens` / `password_reset_tokens` 廃止、`auth_identities` 採用、`users_id_seq` 採番を明示する。

## Non-goals
- API実装、認可ロジック、AuthZ判定の実装変更。
- DBランタイム契約外の新規要件追加。
- Notionページ自体の編集。

## Done conditions
- 旧仕様 -> 現行仕様の差分が1文書にまとまっている。
- 差分の根拠が `database/postgres/migrations` / `docs/DATABASE.md` と一致している。
- 参照先ファイルと検証コマンドが文書化されている。
