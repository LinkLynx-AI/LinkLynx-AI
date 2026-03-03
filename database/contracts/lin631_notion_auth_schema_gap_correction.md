# LIN-631 Notion設計差分是正（認証スキーマ）

## 1. 目的

現行 `main` の認証スキーマを基準に、Notion側の旧設計との差分を明示し、
実装・ドキュメントの参照基準を統一する。

本ドキュメントのスコープは「差分整理と参照固定」のみであり、
API仕様・認可実装・運用フローの追加定義は行わない。

## 2. 現行仕様の正本

- `database/postgres/migrations/*.sql`（正）
- `database/postgres/schema.sql`（派生スナップショット）
- `docs/DATABASE.md`

## 3. 認証スキーマ差分（旧仕様 -> 現行）

| 項目 | 旧仕様（Notion設計側） | 現行 `main` | 根拠 |
| --- | --- | --- | --- |
| `users.email_verified` | あり | 廃止済み | `0001_lin137_auth_profile.up.sql` で作成、`0006_lin621_remove_local_auth_assets.up.sql` で削除 |
| `users.password_hash` | あり | 廃止済み | `0001_lin137_auth_profile.up.sql` で作成、`0006_lin621_remove_local_auth_assets.up.sql` で削除 |
| `email_verification_tokens` | あり | 廃止済み | `0001_lin137_auth_profile.up.sql` で作成、`0006_lin621_remove_local_auth_assets.up.sql` で削除 |
| `password_reset_tokens` | あり | 廃止済み | `0001_lin137_auth_profile.up.sql` で作成、`0006_lin621_remove_local_auth_assets.up.sql` で削除 |
| `auth_identities(provider, provider_subject, principal_id)` | なし | 採用済み | `0005_lin614_auth_identities.up.sql` |
| `users.id` のデフォルト採番 | 明示なし | `users_id_seq` を採用 | `0007_lin622_users_id_sequence_for_provisioning.up.sql` |

## 4. 現行認証スキーマ（要点）

### 4.1 `users`

現行 `users` には次の認証差分反映が入っている。

- `email_verified` は存在しない。
- `password_hash` は存在しない。
- `id` は `nextval('users_id_seq')` をデフォルトに持つ。

参照:

- `database/postgres/generated/public.users.md`
- `database/postgres/schema.sql`

### 4.2 `auth_identities`

外部認証主体を `users.id`（`principal_id`）へ正規化する。

- 主キー: `(provider, provider_subject)`
- 外部キー: `principal_id -> users.id`

参照:

- `database/postgres/migrations/0005_lin614_auth_identities.up.sql`
- `database/postgres/generated/public.auth_identities.md`

## 5. 検証手順

実装前後で以下を実行して差分記述の整合を確認する。

```bash
rg -n "auth_identities|email_verification_tokens|password_reset_tokens|password_hash|email_verified" database/postgres/migrations
make db-schema-check
```

## 6. 運用ノート

- Notion側の設計更新時は、本ドキュメントと `docs/DATABASE.md` の整合を同時に確認する。
- 認証スキーマの事実確認は migration と生成ドキュメントを優先し、口頭情報のみで更新しない。

