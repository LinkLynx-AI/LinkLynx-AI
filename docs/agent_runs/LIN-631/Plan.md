# LIN-631 Plan

## Milestones
1. 現行 `main` の認証スキーマ定義を migration から抽出する。
2. 旧仕様と現行仕様の差分を認証スコープに限定して整理する。
3. 差分是正ドキュメントを `database/contracts` に追加する。
4. `docs/DATABASE.md` から参照可能な導線を追加する。
5. 検証コマンドを実行し、結果を記録する。

## Validation commands
- `rg -n "auth_identities|email_verification_tokens|password_reset_tokens|password_hash|email_verified" database/postgres/migrations`
- `make db-schema-check`

## Acceptance checks
- 認証差分表に「削除済み要素」と「現行採用要素」が明示されている。
- 各差分に root cause となる migration ID が紐づいている。
- 文書の参照先が実在し、追跡可能である。
