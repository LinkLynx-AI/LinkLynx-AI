# V1 Traceability Ledger

最終更新: 2026-03-13

この文書は、`Linear` の親子構造や issue 状態を後で整理し直しても、現在の実装アーティファクトとタスクの対応を失わないためのローカル台帳です。

## 運用原則

1. 実装有無の判定は `Linear` 状態ではなく、まずリポジトリ内アーティファクトで行う。
2. 安定キーは branch 名ではなく、以下を使う。
- migration basename
- contract filename
- `docs/agent_runs/LIN-*`
3. `Linear` を再編するときは、既存 migration/contract/run-doc をむやみにリネームせず、この台帳に新しい対応先を追記する。
4. `Linear` 状態とコード状態がずれても、この台帳を見れば「何が実装済みか」を判定できるように保つ。

## Current DB-backed v1 mapping

| Local artifact key | Current repo artifact | Original Linear anchor | Local state | Notes |
| --- | --- | --- | --- | --- |
| `db.migration.0008.lin632` | `0008_lin632_arbitrary_roles_spicedb_prep` | `LIN-632` | active | 任意ロール/SpiceDB移行前提の基盤。 |
| `db.migration.0009.lin633` | `0009_lin633_channel_user_overrides_spicedb` | `LIN-633` | active | channel user override の tri-state 契約。 |
| `db.migration.0010.lin634` | `0010_lin634_channel_hierarchy_category_thread` | `LIN-634` | active | category/thread の階層メタデータ。 |
| `db.migration.0011.lin857` | `0011_lin857_drop_legacy_permission_assets_post_cutover` | `LIN-857` | active | 旧権限資産の cutover 後削除。 |
| `db.migration.0012.lin635` | `0012_lin635_message_reply_pin_persistence` | `LIN-635` | active | reply reference / pin persistence。 |
| `db.migration.0013.lin636` | `0013_lin636_message_reaction_persistence` | `LIN-636` | active | reaction persistence。main 反映有無は別途確認する。 |
| `db.migration.0014.lin637` | `0014_lin637_attachment_metadata_persistence` | `LIN-637` | active | attachment metadata persistence。 |
| `db.migration.0015.lin803` | `0015_lin803_server_channel_minimal_contract` | `LIN-803` | active | もとは `0008` だったが、2026-03-07 に `sqlx` version collision 解消のため `0015` へ改番。 |
| `db.migration.0016.lin822` | `0016_lin822_minimal_moderation` | `LIN-822` / implementation run is tracked under `LIN-802` | active | もとは `0012`。2026-03-07 に改番。Linear 上の `LIN-822` 状態が `Backlog` でも、コード/DB上は実装済み。 |
| `db.migration.0017.lin939` | `0017_lin939_profile_banner_key` | `LIN-939` | active | `users.banner_key` を追加し、profile media の key persistence 契約を有効化。 |
| `db.migration.0018.lin941` | `0018_lin941_channel_category_contract` | `LIN-941` | active | もとは `0017`。2026-03-13 に `0017` 重複 collision を解消するため `0018` へ改番。 |
| `db.migration.0019.lin948` | `0019_lin948_message_create_idempotency` | `LIN-948` | active | もとは `0017`。2026-03-13 に `sqlx` migration version collision 解消のため `0019` へ改番。 |
| `db.migration.0020.lin941` | `0020_lin941_channel_category_constraints` | `LIN-941` | active | もとは `0018`。2026-03-13 に `0017` 重複 collision 解消のため `0020` へ改番。 |

## Current runbook follow-up mapping

| Local artifact key | Current repo artifact | Original Linear anchor | Local state | Notes |
| --- | --- | --- | --- | --- |
| `runbook.message_v1.followup.lin981` | `docs/runbooks/message-v1-api-ws-contract-runbook.md` | `LIN-981` | active | edit/delete contract と durable event transport を current v1 delivery gate から分離し、tracked follow-up として維持。次回目標日は 2026-04-15。 |

## When Linear is reorganized

1. 新しい親子関係や統合先 issue をこの台帳に追記する。
2. 実装済み判定は `Local artifact key` と現物ファイルで行う。
3. 過去の `docs/agent_runs/LIN-*` は履歴として残し、必要なら「現在の対応先」を追記する。
4. migration 番号変更が必要になった場合は、変更理由と旧番号を必ずここに残す。
