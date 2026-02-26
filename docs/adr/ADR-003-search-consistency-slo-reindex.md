# ADR-003 Search Consistency Model, Lag SLO, and Reindex Strategy

- Status: Accepted
- Date: 2026-02-26
- Related:
  - [LIN-580](https://linear.app/linklynx-ai/issue/LIN-580)
  - [LIN-582](https://linear.app/linklynx-ai/issue/LIN-582)
  - [LIN-594](https://linear.app/linklynx-ai/issue/LIN-594)
  - [LIN-595](https://linear.app/linklynx-ai/issue/LIN-595)
  - [LIN-604](https://linear.app/linklynx-ai/issue/LIN-604)
  - [LIN-139 runtime contracts](../../database/contracts/lin139_runtime_contracts.md)
  - [Search Reindex Runbook (Draft)](../runbooks/search-reindex-runbook.md)

## Context

v0 uses OpenSearch as a derived read model for message search, while Scylla remains the source of truth (SoR) for message body and version.
Without a fixed consistency model and recovery strategy, downstream work (LIN-594, LIN-595, LIN-604) can diverge on assumptions such as strong consistency, acceptable lag, and reindex conditions.

This ADR fixes a shared baseline for:

- Search consistency expectations
- Lag SLO and measurement contract
- Reindex trigger and completion criteria

## Decision

### 1. Consistency model (v0 and v1 baseline)

- Scylla is the SoR for message state.
- OpenSearch is a derived index updated asynchronously from message events.
- Search is operated as eventual consistency.
- The write path must not wait for search indexing acknowledgement.
- If OpenSearch is degraded or unavailable, message persistence and history retrieval continue, while search falls back to degradation mode.

Degradation mode in this ADR means:

- Search freshness is not guaranteed.
- Search results can be stale, partial, or temporarily unavailable.
- API-level error contracts are not defined here and must be fixed in LIN-595.

### 2. SLI definition

Primary SLI:

- `search_reflect_lag_seconds = indexed_at - message_persisted_at`

Term definitions:

- `message_persisted_at`: timestamp when message persistence to Scylla is completed.
- `indexed_at`: timestamp when the indexer receives successful OpenSearch write acknowledgement for the same `message_id` and `version`.

Supporting operational indicators:

- `indexing_success_rate`
- `reindex_backlog_count`
- `search_error_rate`

### 3. SLO targets

- v0 target: `P95(search_reflect_lag_seconds) <= 60s`
- v1 target: `P95(search_reflect_lag_seconds) <= 30s`

Violation detection:

- Alert condition is met when P95 exceeds the environment target for 3 consecutive 5-minute windows.

### 4. Measurement method

Window and aggregation:

- Primary rollup window: 5 minutes
- Daily report aggregation: UTC day

Population:

- Message events intended for search indexing (`MessageCreated`, `MessageUpdated`, `MessageDeleted`)
- Measured per environment (at minimum `prod`; optional `staging` for rehearsal)

Exclusions:

- Approved maintenance windows
- Explicitly paused indexer windows with incident record
- Outdated events rejected as version conflict (`incoming.version <= stored.version`), tracked separately

Missing data handling:

- No eligible events in a window: mark as `N/A` (not SLO violation)
- Missing telemetry pipeline while events exist: mark as observation failure and open incident follow-up

Review-reproducible measurement procedure:

1. Sample persisted messages with `message_id`, `version`, and `message_persisted_at`.
2. Fetch corresponding indexing success records with `indexed_at`.
3. Compute lag per record and aggregate P95 per 5-minute window.
4. Confirm daily summary can be reproduced from raw records.
5. Cross-check that exclusions are explicitly tagged with reason and ticket.

### 5. Reindex strategy

v0 baseline:

- Reindex source is Scylla.
- Reindex write to OpenSearch must keep version semantics from `lin139_runtime_contracts.md` (`version_type=external`).
- Version conflicts are treated as stale-event drops, not hard failures.

v1 extension point:

- Redpanda replay can be added for faster incremental catch-up.
- Scylla remains fallback SoR for correctness and full rebuild.
- Detailed v1 operational design is deferred to LIN-604.

### 6. Reindex trigger categories

Reindex is started when any category below is satisfied and the source system is healthy enough to run:

1. Search outage
- OpenSearch unavailable or cluster health red for at least 10 minutes, or
- `indexing_success_rate < 95%` for 2 consecutive 5-minute windows

2. Sustained lag
- P95 lag above SLO target for 3 consecutive 5-minute windows

3. Consistency drift
- Sample mismatch ratio over affected range is more than `0.5%` across at least 1,000 sampled messages, or
- Any critical mismatch (`version` rollback, tombstone mismatch) is detected

4. Mapping incompatibility
- Mapping-related indexing failures continue after corrective attempt and require rebuild

### 7. Reindex completion criteria

A reindex execution is complete only if all conditions below are true:

1. Backlog cleared
- `reindex_backlog_count = 0` for 2 consecutive 5-minute windows

2. Sample consistency within threshold
- Mismatch ratio is `<= 0.5%` on at least 1,000 sampled messages
- Critical mismatch count is `0`

3. Search error rate converged
- `search_error_rate < 1%` for 2 consecutive 5-minute windows

### 8. Scope boundaries with downstream issues

- LIN-594: fixes index shape and ingestion path implementation under this ADR contract.
- LIN-595: fixes search API request/response contract, including degradation-mode response policy.
- LIN-604: fixes v1 redundancy, ILM, and measured reindex operations.

Out of scope for LIN-582:

- OpenSearch cluster redundancy implementation
- ILM policy implementation
- Strong-consistency search guarantees
- Runtime code changes

## ADR-001 compatibility checklist result

Result: PASS (no schema contract change introduced by this ADR)

- Additive-only rule: not applicable because no event payload field is added/removed/changed
- Consumer impact: none in runtime contract; this ADR only fixes operational policy
- Monitoring and rollback readiness: defined via SLI/SLO and linked runbook
- Documentation update scope: ADR and runbook are linked and bounded

## Verification scenarios

1. A reviewer can reproduce lag measurement from procedure only.
2. A tabletop outage simulation can execute degradation and recovery sequence without gaps.
3. Reindex start and completion decisions can be made unambiguously from thresholds in this document.

## Consequences

- Search semantics are fixed as eventual consistency before implementation issues proceed.
- v0 and v1 share one lag model and trigger language, reducing migration ambiguity.
- Runbook work for DR and Search Ops can reuse the same trigger and completion contract.
