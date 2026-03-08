# DATABASE.md

最終更新: 2026-03-08

このドキュメントは、リポジトリ内の定義ファイルを基準にした「現在のDB状態」をまとめたものです。
実行中のDBインスタンスを直接参照したスナップショットではありません。

基準ファイル:
- `database/postgres/migrations/*.sql`（正）
- `database/postgres/schema.sql`（派生スナップショット）
- `database/scylla/001_lin139_messages.cql`

補助台帳:
- `docs/V1_TRACEABILITY.md`（Linear再編時も残る、実装アーティファクト起点の対応表）

## 1. 全体構成

- PostgreSQL: ユーザー、ギルド、権限、招待、監査、既読、Outbox などの正データ
- ScyllaDB: メッセージ SoR（本文、編集状態、履歴ページング、read_state_hotpath）
- GCS: 添付バイナリオブジェクトの SoR（署名URL運用 + 保持/復旧基準）

## 2. PostgreSQL の現在状態

適用順の migration（リポジトリ定義）:
1. `0001_lin137_auth_profile`
2. `0002_lin138_guild_channel_invite`
3. `0003_lin139_permissions_reads_outbox`
4. `0004_lin131_db_runtime_helpers`
5. `0005_lin614_auth_identities`
6. `0006_lin621_remove_local_auth_assets`
7. `0007_lin622_users_id_sequence_for_provisioning`
8. `0008_lin632_arbitrary_roles_spicedb_prep`
9. `0009_lin633_channel_user_overrides_spicedb`
10. `0010_lin634_channel_hierarchy_category_thread`
11. `0011_lin857_drop_legacy_permission_assets_post_cutover`
12. `0012_lin635_message_reply_pin_persistence`
13. `0013_lin636_message_reaction_persistence`
14. `0014_lin637_attachment_metadata_persistence`
15. `0015_lin803_server_channel_minimal_contract`
16. `0016_lin822_minimal_moderation`
17. `0017_lin941_channel_category_contract`

### 2.1 型（ENUM）

- `channel_type`: `guild_text`, `guild_category`, `dm`
- `channel_hierarchy_kind`: `category_child`, `thread`
- `moderation_report_status`: `open`, `resolved`
- `audit_action`: `INVITE_CREATE`, `INVITE_DISABLE`, `GUILD_MEMBER_JOIN`, `GUILD_MEMBER_LEAVE`, `ROLE_ASSIGN`, `ROLE_REVOKE`, `CHANNEL_CREATE`, `CHANNEL_UPDATE`, `CHANNEL_DELETE`, `MESSAGE_DELETE_MOD`, `USER_BAN`, `USER_UNBAN`, `REPORT_CREATE`, `MUTE_CREATE`, `REPORT_RESOLVE`, `REPORT_REOPEN`
- `outbox_status`: `PENDING`, `SENT`, `FAILED`

### 2.2 テーブル一覧

- `users`
- `auth_identities`
- `guilds`
- `guild_members`
- `invites`
- `invite_uses`
- `channels`
- `dm_participants`
- `dm_pairs`
- `guild_roles_v2`
- `guild_member_roles_v2`
- `channel_role_permission_overrides_v2`
- `channel_user_permission_overrides_v2`
- `channel_hierarchies_v2`
- `message_references_v2`
- `channel_pins_v2`
- `message_reactions_v2`
- `message_attachments_v2`
- `moderation_reports`
- `moderation_mutes`
- `channel_reads`
- `channel_last_message`
- `audit_logs`
- `outbox_events`

### 2.3 関係モデル（要点）

- `guilds.owner_id -> users.id`
- `users.id` は `users_id_seq` デフォルト採番により初回認証時プロビジョニングを許容
- `guilds.id` と `channels.id` はデフォルト採番（`guilds_id_seq` / `channels_id_seq`）を許容
- `auth_identities(provider, provider_subject)` は外部認証主体（例: Firebase UID）を一意化し、`principal_id -> users.id` へ正規化
- `guild_members(guild_id, user_id)` は `guilds/users` への多対多
- `channels` は `channel_type` でギルドテキストチャネル/カテゴリコンテナ/DM を表現
- `guilds.name` と `channels(type in ('guild_text', 'guild_category')).name` は空文字（空白のみ）を拒否
- `dm_pairs` は `user_low < user_high` 制約と `channel_id` 一意制約で DM 1対1 を保証
- `guild_roles_v2` + `guild_member_roles_v2` + `channel_role_permission_overrides_v2` は LIN-632 で導入された任意ロールモデル（LIN-857でv0資産を削除し単一化）
- `channel_user_permission_overrides_v2` は LIN-633 で導入されたユーザー単位の tri-state override で、`channel_role_permission_overrides_v2` と併存する
- `channel_hierarchies_v2` は LIN-634 で導入されたカテゴリ配下/スレッド識別の階層メタデータで、`guild_category -> guild_text` または `guild_text -> guild_text(thread)` の親子関係を保持する
- `message_references_v2` は LIN-635 で導入された返信参照メタデータで、`message_id` 単位で `reply_to_message_id` を一意追跡する
- `channel_pins_v2` は LIN-635 で導入されたピン留め状態メタデータで、`pinned_at/pinned_by` と `unpinned_at/unpinned_by` により監査可能な状態遷移を保持する
- `message_reactions_v2` は LIN-636 で導入されたリアクションメタデータで、`(message_id, emoji, user_id)` 主キーにより重複リアクションを防止する
- `message_attachments_v2` は LIN-637 で導入された添付メタデータで、GCS object key と保持/削除監査列（`deleted_at`, `retention_until`）を保持する
- `moderation_reports` は LIN-822 で導入された最小通報キューで、`status=open/resolved` と `resolved_by/resolved_at` 整合制約を保持する
- `moderation_mutes` は LIN-822 で導入された最小ミュート管理で、`(guild_id, target_user_id)` 一意制約により同時多重ミュートを防止する
- `channel_reads` は `(channel_id, user_id)` を主キーとして既読位置管理
- `channel_last_message` はチャネル最新メッセージの参照を保持
- `audit_logs` は監査イベント記録
- `outbox_events` は非同期イベント配信（Outbox）

### 2.4 関数・トリガー（現在有効な契約）

関数:
- `set_users_updated_at()`
- `enforce_channel_hierarchies_v2_scope()`
- `enforce_dm_pairs_channel_type()`
- `upsert_channel_reads_monotonic(...)`
- `claim_outbox_events(p_limit, p_lease_seconds)`
- `mark_outbox_event_sent(p_id)`
- `mark_outbox_event_failed(p_id, p_retry_seconds)`

トリガー:
- `trg_users_set_updated_at`（`users` 更新時に `updated_at` 更新）
- `trg_enforce_channel_hierarchies_v2_scope`（`channel_hierarchies_v2` の child/parent/guild整合を強制）
- `trg_enforce_dm_pairs_channel_type`（`dm_pairs.channel_id` が `channels.type=dm` を強制）

### 2.5 主要インデックス（抜粋）

- `uq_users_email_lower`（`lower(email)` 一意）
- `uq_auth_identities_provider_principal`（`provider + principal_id` 一意）
- `idx_auth_identities_principal_id`
- `idx_guild_members_user`
- `idx_guild_members_user_joined_guild`
- `idx_channels_guild`（`type in ('guild_text', 'guild_category')` 条件付き）
- `idx_channels_guild_created_id`（`type in ('guild_text', 'guild_category')` 条件付き）
- `idx_dm_participants_user`
- `idx_invites_guild`, `idx_invites_expires`
- `idx_channel_hierarchies_v2_parent_pos`
- `idx_channel_hierarchies_v2_guild_kind`
- `idx_msg_refs_v2_channel_reply`
- `idx_ch_pins_v2_active`
- `idx_ch_pins_v2_message`
- `idx_msg_reactions_v2_msg_emoji_created`
- `uq_msg_att_v2_object_key`
- `idx_msg_att_v2_message_created`
- `idx_msg_att_v2_retention_active`
- `idx_msg_att_v2_deleted_at`
- `idx_channel_user_overrides_v2_user`
- `idx_channel_user_overrides_v2_guild_user`
- `idx_channel_reads_user`
- `idx_channel_last_message_time`
- `idx_audit_guild_time`
- `idx_outbox_pending`, `idx_outbox_failed`

### 2.6 Postgres Operations Baseline (LIN-588)

The source of truth for Postgres operations (forward-only migration, pool exhaustion controls, single-AZ outage policy, and PITR requirements) is:

- `database/contracts/lin588_postgres_operations_baseline.md`
- `docs/runbooks/postgres-pitr-runbook.md`

### 2.7 Session/Resume Runtime Baseline (LIN-587)

The source of truth for Dragonfly-backed session continuity (`session TTL`, `resume`, `heartbeat`, `degraded behavior`) is:

- `database/contracts/lin587_session_resume_runtime_contract.md`
- `docs/runbooks/session-resume-dragonfly-operations-runbook.md`

### 2.8 GCS Attachment Operations Baseline (LIN-590)

The source of truth for attachment binary operations on GCS (signed URL policy, object key naming, versioning/retention, and accidental deletion recovery baseline) is:

- `database/contracts/lin590_gcs_signed_url_and_retention_baseline.md`
- `docs/runbooks/gcs-signed-url-retention-operations-runbook.md`
### 2.9 Event Stream Operations Baseline (LIN-601)

The source of truth for v1 Redpanda event stream operations (topic naming, retention, replay/reprocess, and outage recovery baseline) is:

- `database/contracts/lin601_redpanda_event_stream_baseline.md`
- `docs/runbooks/redpanda-topic-retention-replay-runbook.md`

### 2.10 Auth Schema Gap Correction (LIN-631)

The source of truth for auth-schema gap correction between legacy Notion design and current `main` is:

- `database/contracts/lin631_notion_auth_schema_gap_correction.md`

### 2.11 Arbitrary Role Model / SpiceDB Mapping Contract (LIN-632)

The source of truth for arbitrary-role migration model and Postgres -> SpiceDB tuple mapping is:

- `database/contracts/lin632_spicedb_role_model_migration_contract.md`

### 2.12 Channel User Override / SpiceDB Mapping Contract (LIN-633)

The source of truth for channel-level user override (tri-state), evaluation precedence, and role/user override -> SpiceDB tuple conversion is:

- `database/contracts/lin633_channel_user_override_spicedb_contract.md`

### 2.13 Channel Hierarchy (Category/Thread) Contract (LIN-634)

The source of truth for channel hierarchy schema (category/thread), scope constraints, and compatibility policy is:

- `database/contracts/lin634_channel_hierarchy_category_thread_contract.md`

### 2.14 Channel Category Contract Delta (LIN-941)

The source of truth for v1 category container representation (`channel_type.guild_category`), category-child parent scope, and category non-messageable compatibility policy is:

- `database/contracts/lin634_channel_hierarchy_category_thread_contract.md`

### 2.15 Legacy Permission Assets Removal Contract (LIN-857)

The source of truth for post-cutover removal of legacy permission tables/columns is:

- `database/contracts/lin857_legacy_permission_assets_removal_contract.md`

### 2.16 Message Reply/Pin Persistence Contract (LIN-635)

The source of truth for message reply reference tracking, pin/unpin audit columns, and tombstone compatibility policy is:

- `database/contracts/lin635_message_reply_pin_persistence_contract.md`

### 2.17 Message Reaction Persistence Contract (LIN-636)

The source of truth for message reaction persistence, duplicate-prevention constraints, and message-based aggregation index policy is:

- `database/contracts/lin636_message_reaction_persistence_contract.md`

### 2.18 Attachment Metadata Persistence Contract (LIN-637)

The source of truth for attachment metadata persistence, logical deletion/retention audit columns, and LIN-590 alignment policy is:

- `database/contracts/lin637_attachment_metadata_persistence_contract.md`

### 2.19 Minimal Moderation Contract (LIN-822)

The source of truth for minimal moderation persistence (`moderation_reports`, `moderation_mutes`), `audit_action` enum extension, and report state transitions is:

- `database/contracts/lin822_minimal_moderation_contract.md`

### 2.20 SpiceDB Namespace/Relation/Permission Model Contract (LIN-862)

The source of truth for SpiceDB namespace/relation/permission design aligned with LIN-861 matrix and LIN-632/LIN-633 tuple mapping is:

- `database/contracts/lin862_spicedb_namespace_relation_permission_contract.md`

### 2.21 Postgres -> SpiceDB Tuple Mapping/Sync Contract (LIN-864)

The source of truth for Postgres `*_v2` permission data to canonical SpiceDB tuple conversion, initial backfill contract, outbox delta-sync semantics, and full-resync operational hook is:

- `database/contracts/lin864_postgres_spicedb_tuple_sync_contract.md`
## 3. ScyllaDB の現在状態

基準: `database/scylla/001_lin139_messages.cql`

### 3.1 Keyspace

- `chat`
- レプリケーション: `NetworkTopologyStrategy`（ファイル内デフォルトは `dc1:3`、環境に応じて変更前提）

### 3.2 テーブル

- `chat.messages_by_channel`
  - 主キー: `((channel_id, bucket), message_id)`
  - クラスタ順: `message_id DESC`
  - 用途: チャネル履歴の主ストア（`version` / `edited_at` / `is_deleted` による編集・削除の最新状態を保持）
- `chat.messages_by_id`（任意）
  - 主キー: `(message_id)`
  - 用途: message_id 直参照

### 3.3 運用契約（関連クエリ）

- 履歴カーソル: `database/scylla/queries/lin288_history_cursor_paging.cql`
  - `(created_at, message_id)` で forward/backward 走査
- 冪等保存: `database/scylla/queries/lin289_idempotent_write_strategy.cql`
  - `INSERT ... IF NOT EXISTS` による重複防止
  - 再送時の read-before-retry を規定

### 3.4 Scylla Operations Baseline (LIN-589)

The source of truth for Scylla operations (SoR boundary, partition review criteria, latest-N measurement perspective, node-loss continuity policy, and minimum backup/restore procedure) is:

- `database/contracts/lin589_scylla_sor_partition_baseline.md`
- `docs/runbooks/scylla-node-loss-backup-runbook.md`

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
- LIN-589 Scylla operations baseline:
  - `database/contracts/lin589_scylla_sor_partition_baseline.md`
  - `docs/runbooks/scylla-node-loss-backup-runbook.md`
- LIN-590 GCS attachment operations baseline:
  - `database/contracts/lin590_gcs_signed_url_and_retention_baseline.md`
  - `docs/runbooks/gcs-signed-url-retention-operations-runbook.md`
- LIN-601 Event stream operations baseline:
  - `database/contracts/lin601_redpanda_event_stream_baseline.md`
  - `docs/runbooks/redpanda-topic-retention-replay-runbook.md`
- LIN-631 Notion auth schema gap correction:
  - `database/contracts/lin631_notion_auth_schema_gap_correction.md`
- LIN-632 arbitrary role / SpiceDB migration contract:
  - `database/contracts/lin632_spicedb_role_model_migration_contract.md`
- LIN-633 channel user override / SpiceDB mapping contract:
  - `database/contracts/lin633_channel_user_override_spicedb_contract.md`
- LIN-634 channel hierarchy (category/thread) contract:
  - `database/contracts/lin634_channel_hierarchy_category_thread_contract.md`
- LIN-857 legacy permission assets removal contract:
  - `database/contracts/lin857_legacy_permission_assets_removal_contract.md`
- LIN-635 message reply/pin persistence contract:
  - `database/contracts/lin635_message_reply_pin_persistence_contract.md`
- LIN-636 message reaction persistence contract:
  - `database/contracts/lin636_message_reaction_persistence_contract.md`
- LIN-637 attachment metadata persistence contract:
  - `database/contracts/lin637_attachment_metadata_persistence_contract.md`
- LIN-862 SpiceDB namespace/relation/permission model contract:
  - `database/contracts/lin862_spicedb_namespace_relation_permission_contract.md`
