# DATABASE.md

最終更新: 2026-02-27

このドキュメントは、リポジトリ内の定義ファイルを基準にした「現在のDB状態」をまとめたものです。
実行中のDBインスタンスを直接参照したスナップショットではありません。

基準ファイル:
- `database/postgres/migrations/*.sql`（正）
- `database/postgres/schema.sql`（派生スナップショット）
- `database/scylla/001_lin139_messages.cql`

## 1. 全体構成

- PostgreSQL: ユーザー、ギルド、権限、招待、監査、既読、Outbox などの正データ
- ScyllaDB: メッセージ本文ストア（チャネル履歴、冪等保存、ページング）

## 2. PostgreSQL の現在状態

適用順の migration（リポジトリ定義）:
1. `0001_lin137_auth_profile`
2. `0002_lin138_guild_channel_invite`
3. `0003_lin139_permissions_reads_outbox`
4. `0004_lin131_db_runtime_helpers`
5. `0005_lin614_auth_identities`

### 2.1 型（ENUM）

- `channel_type`: `guild_text`, `dm`
- `role_level`: `owner`, `admin`, `member`
- `audit_action`: `INVITE_CREATE`, `INVITE_DISABLE`, `GUILD_MEMBER_JOIN`, `GUILD_MEMBER_LEAVE`, `ROLE_ASSIGN`, `ROLE_REVOKE`, `CHANNEL_CREATE`, `CHANNEL_UPDATE`, `CHANNEL_DELETE`, `MESSAGE_DELETE_MOD`, `USER_BAN`, `USER_UNBAN`
- `outbox_status`: `PENDING`, `SENT`, `FAILED`

### 2.2 テーブル一覧

- `users`
- `auth_identities`
- `email_verification_tokens`
- `password_reset_tokens`
- `guilds`
- `guild_members`
- `invites`
- `invite_uses`
- `channels`
- `dm_participants`
- `dm_pairs`
- `guild_roles`
- `guild_member_roles`
- `channel_permission_overrides`
- `channel_reads`
- `channel_last_message`
- `audit_logs`
- `outbox_events`

### 2.3 関係モデル（要点）

- `guilds.owner_id -> users.id`
- `auth_identities(provider, provider_subject)` は外部認証主体（例: Firebase UID）を一意化し、`principal_id -> users.id` へ正規化
- `guild_members(guild_id, user_id)` は `guilds/users` への多対多
- `channels` は `channel_type` でギルドチャネル/DM を表現
- `dm_pairs` は `user_low < user_high` 制約と `channel_id` 一意制約で DM 1対1 を保証
- `guild_roles` + `guild_member_roles` + `channel_permission_overrides` でロール/権限上書き
- `channel_reads` は `(channel_id, user_id)` を主キーとして既読位置管理
- `channel_last_message` はチャネル最新メッセージの参照を保持
- `audit_logs` は監査イベント記録
- `outbox_events` は非同期イベント配信（Outbox）

### 2.4 関数・トリガー（現在有効な契約）

関数:
- `set_users_updated_at()`
- `enforce_dm_pairs_channel_type()`
- `upsert_channel_reads_monotonic(...)`
- `claim_outbox_events(p_limit, p_lease_seconds)`
- `mark_outbox_event_sent(p_id)`
- `mark_outbox_event_failed(p_id, p_retry_seconds)`

トリガー:
- `trg_users_set_updated_at`（`users` 更新時に `updated_at` 更新）
- `trg_enforce_dm_pairs_channel_type`（`dm_pairs.channel_id` が `channels.type=dm` を強制）

### 2.5 主要インデックス（抜粋）

- `uq_users_email_lower`（`lower(email)` 一意）
- `uq_auth_identities_provider_principal`（`provider + principal_id` 一意）
- `idx_auth_identities_principal_id`
- `idx_guild_members_user`
- `idx_channels_guild`（`type='guild_text'` 条件付き）
- `idx_dm_participants_user`
- `idx_invites_guild`, `idx_invites_expires`
- `idx_channel_reads_user`
- `idx_channel_last_message_time`
- `idx_audit_guild_time`
- `idx_outbox_pending`, `idx_outbox_failed`
- `idx_email_verification_expires`, `idx_password_reset_expires`

### 2.6 Postgres Operations Baseline (LIN-588)

The source of truth for Postgres operations (forward-only migration, pool exhaustion controls, single-AZ outage policy, and PITR requirements) is:

- `database/contracts/lin588_postgres_operations_baseline.md`
- `docs/runbooks/postgres-pitr-runbook.md`

### 2.7 Session/Resume Runtime Baseline (LIN-587)

The source of truth for Dragonfly-backed session continuity (`session TTL`, `resume`, `heartbeat`, `degraded behavior`) is:

- `database/contracts/lin587_session_resume_runtime_contract.md`
- `docs/runbooks/session-resume-dragonfly-operations-runbook.md`

## 3. ScyllaDB の現在状態

基準: `database/scylla/001_lin139_messages.cql`

### 3.1 Keyspace

- `chat`
- レプリケーション: `NetworkTopologyStrategy`（ファイル内デフォルトは `dc1:3`、環境に応じて変更前提）

### 3.2 テーブル

- `chat.messages_by_channel`
  - 主キー: `((channel_id, bucket), message_id)`
  - クラスタ順: `message_id DESC`
  - 用途: チャネル履歴の主ストア
- `chat.messages_by_id`（任意）
  - 主キー: `(message_id)`
  - 用途: message_id 直参照

### 3.3 運用契約（関連クエリ）

- 履歴カーソル: `database/scylla/queries/lin288_history_cursor_paging.cql`
  - `(created_at, message_id)` で forward/backward 走査
- 冪等保存: `database/scylla/queries/lin289_idempotent_write_strategy.cql`
  - `INSERT ... IF NOT EXISTS` による重複防止
  - 再送時の read-before-retry を規定

## 4. 変更時の運用ルール

- PostgreSQL の正は `database/postgres/migrations`。`schema.sql` は派生
- 変更時は次を実行
  - `make db-migrate`
  - `make db-migrate-info`
  - `make db-schema`
  - `make db-schema-check`
  - `make db-seed`（開発用の仮データを再投入）
  - `make gen`（`tbls` で `database/postgres/generated` に regex + ドキュメント/ER図を再生成）
- Scylla の契約変更時は `database/scylla/*.cql` と `database/contracts/*.md` を合わせて更新

## 5. Related Operational Documents

- LIN-588 Postgres operations baseline:
  - `database/contracts/lin588_postgres_operations_baseline.md`
  - `docs/runbooks/postgres-pitr-runbook.md`
- LIN-587 Session/resume operations baseline:
  - `database/contracts/lin587_session_resume_runtime_contract.md`
  - `docs/runbooks/session-resume-dragonfly-operations-runbook.md`
