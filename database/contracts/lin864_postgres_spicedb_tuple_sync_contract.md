# LIN-864 Postgres -> SpiceDB Tuple写像/同期 実装契約

## Purpose

- target issue: LIN-864
- LIN-632 / LIN-633 / LIN-862 で固定した写像契約を、実装可能な backfill + 差分同期形へ落とし込む。
- Postgresの `*_v2` 権限データから canonical relation 名の SpiceDB tuple を生成する。
- outbox差分同期、失敗検知、最小再同期フックを定義する。

## Scope

In scope:
- `rust/apps/api/src/authz/tuple_sync.rs` における tuple mapping 実装
- `guild_roles_v2` / `guild_member_roles_v2` / `channel_role_permission_overrides_v2` / `channel_user_permission_overrides_v2` の backfill
- `claim_outbox_events` / `mark_outbox_event_sent` / `mark_outbox_event_failed` を使う差分同期ループ
- 同期失敗の検知メトリクスと full resync フック

Out of scope:
- SpiceDB Authorizer への本番接続切替（LIN-865）
- APIハンドラへの認可適用（LIN-866/LIN-867）
- 本番運用のSLO閾値確定（LIN-868で統合）

## 1. Canonical tuple mapping

### 1.1 Source -> Tuple

| Source | Condition | Tuple |
| --- | --- | --- |
| `guild_member_roles_v2` | row exists | `role:{guild_id}/{role_key}#member@user:{user_id}` |
| `guild_roles_v2` | `allow_manage=true` | `guild:{guild_id}#manager@role:{guild_id}/{role_key}#member` |
| `guild_roles_v2` | `allow_view=true` | `guild:{guild_id}#viewer@role:{guild_id}/{role_key}#member` |
| `guild_roles_v2` | `allow_post=true` | `guild:{guild_id}#poster@role:{guild_id}/{role_key}#member` |
| `channel_role_permission_overrides_v2` / `channel_user_permission_overrides_v2` | row exists | `channel:{channel_id}#guild@guild:{guild_id}` |
| `channel_role_permission_overrides_v2` | `can_view=true` | `channel:{channel_id}#viewer_role@role:{guild_id}/{role_key}#member` |
| `channel_role_permission_overrides_v2` | `can_view=false` | `channel:{channel_id}#view_deny_role@role:{guild_id}/{role_key}#member` |
| `channel_role_permission_overrides_v2` | `can_post=true` | `channel:{channel_id}#poster_role@role:{guild_id}/{role_key}#member` |
| `channel_role_permission_overrides_v2` | `can_post=false` | `channel:{channel_id}#post_deny_role@role:{guild_id}/{role_key}#member` |
| `channel_user_permission_overrides_v2` | `can_view=true` | `channel:{channel_id}#viewer_user@user:{user_id}` |
| `channel_user_permission_overrides_v2` | `can_view=false` | `channel:{channel_id}#view_deny_user@user:{user_id}` |
| `channel_user_permission_overrides_v2` | `can_post=true` | `channel:{channel_id}#poster_user@user:{user_id}` |
| `channel_user_permission_overrides_v2` | `can_post=false` | `channel:{channel_id}#post_deny_user@user:{user_id}` |

Rule:
- tri-state `NULL` は tuple を生成しない（inherit）。
- backfill出力は重複除去し、決定的順序で生成する。

## 2. Initial backfill contract

### 2.1 Read order

backfillソースは以下順序で取得する。

1. `guild_roles_v2`
2. `guild_member_roles_v2`
3. `channel_role_permission_overrides_v2`
4. `channel_user_permission_overrides_v2`

各クエリは安定順序（`ORDER BY`）を必須とする。

### 2.2 Backfill output

- 出力は `Vec<SpiceDbTuple>` とし、重複を除去する。
- full resync 時は sink 現在状態との差分を計算し、`Delete(unexpected)` + `Upsert(missing)` を発行する。
- 差分計算対象の `observed` は tuple-sync 管理対象（`role/guild/channel` の canonical relation）のみに限定し、管理外 tuple を削除しない。
- sink が現在状態スナップショットを提供できない場合は full resync を失敗させる（silent success を禁止）。
- 実行結果として最低限以下を返す:
  - 各source行数
  - 生成tuple件数
  - 適用mutation件数

## 3. Delta sync contract (outbox)

### 3.1 Event types

- `authz.tuple.guild_role.v1`
- `authz.tuple.guild_member_role.v1`
- `authz.tuple.channel_role_override.v1`
- `authz.tuple.channel_user_override.v1`
- `authz.tuple.full_resync.v1`

### 3.2 Operation semantics

- `op=upsert`
  - 対象行の候補tupleを先に `Delete` し、現行状態tupleを `Upsert` する（置換型同期）。
  - `channel_role_permission_overrides_v2` / `channel_user_permission_overrides_v2` 由来のイベントでは、`channel:{id}#guild@guild:{id}` を常に `Upsert` して guild baseline 継承を維持する。
- `op=delete`
  - 対象行に紐づく候補tupleを `Delete` する。
- `authz.tuple.full_resync.v1`
  - 1回の full backfill を実行する。

### 3.3 Outbox processing

- claim: `claim_outbox_events(limit, lease_seconds)`
- success: `mark_outbox_event_sent(id)`
- failure: `mark_outbox_event_failed(id, retry_seconds)`
- `mark_outbox_event_sent` が失敗した場合は同一イベントを `mark_outbox_event_failed` へフォールバックし、再試行可能状態へ戻す（idempotent 再実行前提）。

同期設定の環境変数:
- `SPICEDB_TUPLE_SYNC_OUTBOX_CLAIM_LIMIT` (default `100`)
- `SPICEDB_TUPLE_SYNC_OUTBOX_LEASE_SECONDS` (default `30`)
- `SPICEDB_TUPLE_SYNC_OUTBOX_RETRY_SECONDS` (default `15`)

## 4. Drift detection and resync hook

- `detect_tuple_drift(expected, observed)` で missing/unexpected を計算する。
- `build_resync_mutations(report)` で再同期用 mutation を生成する。
- 運用上の最小フックとして `authz.tuple.full_resync.v1` を outbox投入し、全件再同期をトリガーできることを契約化する。

## 5. Failure detection and observability

実装は少なくとも以下を記録する。

- outbox claim/success/failure 件数
- full resync 件数
- backfill実行回数
- backfill生成tuple件数
- 適用mutation件数
- apply失敗件数

失敗時ログには最低限以下を含める。
- `event_id`
- `event_type`
- `aggregate_id`
- `reason`

## 6. Compatibility policy

- LIN-864は additive 実装とし、既存AuthZ I/Fを破壊しない。
- SpiceDB Authorizer切替はLIN-865で実施する。
- deny/unavailable 境界は ADR-004 の fail-close 契約を維持する。

## 7. Validation

```bash
make rust-lint
make validate
```

補足:
- `make validate` はローカル依存未導入時に TypeScript 側で失敗する場合がある。Rust差分の検証は `make rust-lint` を最低ゲートとする。
