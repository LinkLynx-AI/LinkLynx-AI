# Search Reindex Runbook (Draft)

- Status: Draft
- Last updated: 2026-02-26
- Owner scope: Search v0 operations baseline
- References:
  - [ADR-003 Search Consistency Model, Lag SLO, and Reindex Strategy](../adr/ADR-003-search-consistency-slo-reindex.md)
  - [LIN-582](https://linear.app/linklynx-ai/issue/LIN-582)
  - [LIN-594](https://linear.app/linklynx-ai/issue/LIN-594)
  - [LIN-595](https://linear.app/linklynx-ai/issue/LIN-595)
  - [LIN-604](https://linear.app/linklynx-ai/issue/LIN-604)
  - [LIN-139 runtime contracts](../../database/contracts/lin139_runtime_contracts.md)

## 1. Purpose and scope

This runbook defines how to start, execute, and close a search reindex operation when eventual-consistency guarantees drift outside ADR-003 limits.

In scope:

- v0 baseline reindex from Scylla SoR
- Trigger and completion decisions
- Verification and incident record expectations

Out of scope:

- OpenSearch redundancy and ILM operation details (LIN-604)
- API response contract for degraded search (LIN-595)
- Index schema implementation details (LIN-594)

## 2. Trigger matrix

Start reindex when any trigger is true and source data is readable.

1. Search outage
- OpenSearch unavailable or red for at least 10 minutes, or
- `indexing_success_rate < 95%` for 2 consecutive 5-minute windows

2. Sustained lag
- `P95(search_reflect_lag_seconds)` above target for 3 consecutive 5-minute windows
- Target is `60s` in v0 and `30s` in v1

3. Consistency drift
- Mismatch ratio is more than `0.5%` in at least 1,000 sampled messages, or
- Any critical mismatch (`version` rollback, tombstone mismatch)

4. Mapping incompatibility
- Mapping-related indexing failure persists after corrective attempt

## 3. Pre-check (before start decision)

1. Create or link incident ticket.
2. Record trigger category and observed metrics.
3. Confirm Scylla read path health.
4. Freeze incompatible mapping changes until operation closes.
5. Define target range (time window, channels, or full dataset).
6. Confirm on-call owner and rollback decision owner.

Do not start if Scylla source is unhealthy or mapping state is still changing.

## 4. Start decision

Start reindex only when both are true:

1. At least one trigger in section 2 is satisfied.
2. Preconditions in section 3 are satisfied.

If not satisfied, continue mitigation and re-evaluate every 5 minutes.

## 5. Execution

### 5.1 Choose operation mode

- Incremental reindex: preferred when affected range is bounded.
- Full reindex: used when drift source is unknown or broad.

### 5.2 Prepare indexing target

1. Confirm target index exists and is writable.
2. Confirm external version guard is enabled for writes.
3. Confirm failure counters and backlog counters are visible.

### 5.3 Extract source records (v0 baseline)

1. Read source records from Scylla for target range.
2. Include required fields (`message_id`, `version`, `content`, `created_at`, `is_deleted`, and routing fields).
3. Preserve ordering and version information required for idempotent replay.

### 5.4 Index to OpenSearch

1. Write with external version semantics.
2. Treat version conflicts as stale-event drops.
3. Retry transport failures with bounded backoff.
4. Stop and escalate on sustained mapping failures.

### 5.5 v1 extension point (not required in v0)

- Redpanda replay can be used for incremental catch-up.
- If replay data is incomplete or uncertain, fall back to Scylla for correctness.

## 6. Verification

All checks below are required.

1. Backlog cleared
- `reindex_backlog_count = 0` for 2 consecutive 5-minute windows

2. Sample consistency check
- Sample at least 1,000 records from the affected range
- Mismatch ratio must be `<= 0.5%`
- Critical mismatch count must be `0`

3. Search error convergence
- `search_error_rate < 1%` for 2 consecutive 5-minute windows

4. Lag recovery
- `P95(search_reflect_lag_seconds)` returns within target for 2 consecutive 5-minute windows

## 7. Convergence decision and close

Declare operation complete only if section 6 passes fully.

Close actions:

1. Mark incident status as recovered.
2. Record operation start/end time, range, and replay volume.
3. Record mismatches found and corrective actions.
4. Record follow-up items for LIN-594/LIN-595/LIN-604/LIN-597 as needed.

## 8. Tabletop rehearsal checklist

Use this checklist to satisfy LIN-582 review scenarios.

1. Simulate OpenSearch outage and confirm trigger classification.
2. Walk through pre-check to completion without adding undocumented decisions.
3. Confirm start and completion decisions are unambiguous from thresholds.
4. Confirm final record template is complete and linkable from parent issue.
