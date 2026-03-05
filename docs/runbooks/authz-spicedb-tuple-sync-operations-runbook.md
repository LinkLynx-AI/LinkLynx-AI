# AuthZ SpiceDB Tuple Sync Operations Runbook

- Status: Draft
- Last updated: 2026-03-04
- Owner scope: LIN-864 tuple mapping/backfill/delta-sync baseline
- References:
  - `database/contracts/lin864_postgres_spicedb_tuple_sync_contract.md`
  - `database/contracts/lin862_spicedb_namespace_relation_permission_contract.md`
  - `docs/adr/ADR-004-authz-fail-close-and-cache-strategy.md`

## 1. Purpose and scope

This runbook defines the minimum operational procedure for Postgres -> SpiceDB tuple synchronization foundation.

In scope:
- tuple mapping verification from Postgres `*_v2` permission tables
- initial backfill procedure
- outbox-based delta sync procedure
- full resync trigger (`authz.tuple.full_resync.v1`)

Out of scope:
- `AUTHZ_PROVIDER=spicedb` request-time check cutover (LIN-865)
- endpoint-level authorization rollout (LIN-866/LIN-867)

## 2. Runtime config contract

Tuple sync runtime config uses the following env keys:

- `SPICEDB_TUPLE_SYNC_OUTBOX_CLAIM_LIMIT` (default `100`)
- `SPICEDB_TUPLE_SYNC_OUTBOX_LEASE_SECONDS` (default `30`)
- `SPICEDB_TUPLE_SYNC_OUTBOX_RETRY_SECONDS` (default `15`)

Notes:
- Current baseline validates and logs these values in Rust runtime.
- Actual service wiring/execution loop is performed by follow-up integration work.

## 3. Backfill procedure (foundation)

Backfill source tables:
1. `guild_roles_v2`
2. `guild_member_roles_v2`
3. `channel_role_permission_overrides_v2`
4. `channel_user_permission_overrides_v2`

Backfill behavior contract:
- read with stable ordering (`ORDER BY`)
- generate canonical tuples
- deduplicate
- apply as `Upsert` mutations

Validation command:

```bash
make rust-lint
```

Relevant test cases:
- `authz::tests::backfill_builder_deduplicates_tuples`
- `authz::tests::tuple_mapping_uses_canonical_relations`

## 4. Delta sync procedure (outbox)

Outbox consumption contract:
- claim: `claim_outbox_events(limit, lease_seconds)`
- success ack: `mark_outbox_event_sent(id)`
- failure ack: `mark_outbox_event_failed(id, retry_seconds)`

Supported event types:
- `authz.tuple.guild_role.v1`
- `authz.tuple.guild_member_role.v1`
- `authz.tuple.channel_role_override.v1`
- `authz.tuple.channel_user_override.v1`
- `authz.tuple.full_resync.v1`

Operation rules:
- `op=upsert`: `Delete(candidate tuples)` + `Upsert(desired tuples)`
- `op=delete`: `Delete(candidate tuples)`
- `mark_outbox_event_sent` 失敗時: 同一イベントを `mark_outbox_event_failed` へフォールバックして再試行可能状態へ戻す（処理は idempotent 前提）

## 5. Full resync trigger (minimum hook)

When drift is detected, insert a `full_resync` event into outbox.

Example payload:

```sql
INSERT INTO outbox_events (id, event_type, aggregate_id, payload)
VALUES (
  9000000001,
  'authz.tuple.full_resync.v1',
  'guild:all',
  '{"reason":"drift_detected"}'::jsonb
);
```

Expected behavior:
- consumer executes one differential full backfill (`Delete(unexpected)` + `Upsert(missing)`)
- drift 計算は tuple-sync 管理対象 relation のみに限定し、管理外 tuple は削除対象に含めない
- sink が current tuple snapshot を返せない場合、full resync は失敗として扱う
- success -> `mark_outbox_event_sent`
- failure -> `mark_outbox_event_failed`

## 6. Failure detection and triage

Required monitoring counters:
- `outbox_claimed_total`
- `outbox_succeeded_total`
- `outbox_failed_total`
- `outbox_full_resync_total`
- `backfill_runs_total`
- `backfill_generated_tuples_total`
- `tuple_mutations_applied_total`
- `sync_apply_failure_total`

Failure triage checkpoints:
1. Verify outbox claim/ack function execution errors.
2. Verify payload schema and event type correctness.
3. Trigger `authz.tuple.full_resync.v1` when drift or repeated failures persist.

## 7. Verification checklist

1. `make rust-lint` passes.
2. tuple mapping tests pass for role/user override canonical relations.
3. sync service tests pass for success/failure/full-resync paths.
4. runtime logs include tuple sync env configuration when `AUTHZ_PROVIDER=spicedb`.
