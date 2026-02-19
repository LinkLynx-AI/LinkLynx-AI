# LIN-135 統合検証

このチェックリストは、migration の適用順序とロールバックの整合性を検証するためのものです。

## 事前条件

- PostgreSQL が `localhost:5432` で起動していること
- `sqlx-cli` がローカルにインストールされていること
- `DATABASE_URL` が検証用データベースを指していること

## 必須 migration 適用順

1. `0001_lin137_auth_profile`
2. `0002_lin138_guild_channel_invite`
3. `0003_lin139_permissions_reads_outbox`

## 実行コマンド

```bash
make db-up
make db-migrate
make db-migrate-info
make db-migrate-revert
make db-migrate
```

## 検証項目

1. `users` の `theme` 制約で不正値が拒否されること
2. `uq_users_email_lower` により、大文字小文字違いの重複メールが拒否されること
3. `password_reset_tokens` が「1ユーザー1有効トークン」を保証すること
4. `invites` で `uses > max_uses` が拒否されること
5. `dm_pairs` で `dm` 以外のチャネル参照が拒否されること
6. `channel_reads` の単調増加 upsert 契約が文書化され、アプリ側SQLに適用されていること
7. `outbox_events` の pending 用インデックスが存在し、取得クエリで利用されること
