# Search v0 Index Design and Ingest Runbook

- Status: Draft
- Last updated: 2026-03-01
- Owner scope: Search ingest baseline (v0)
- References:
  - `docs/adr/ADR-003-search-consistency-slo-reindex.md`
  - `docs/runbooks/search-reindex-runbook.md`
  - `docs/runbooks/message-persist-publish-dispatch-runbook.md`
  - `database/contracts/lin589_scylla_sor_partition_baseline.md`
  - `LIN-594`

## 1. Purpose and scope

This runbook fixes the v0 baseline for minimal OpenSearch index shape and ingest path from message events.

In scope:

- Minimum index fields for message search
- Ingest pipeline contract (message event to OpenSearch document)
- Eventual consistency lag and replay/reingest policy
- Reingest start and completion criteria

Out of scope:

- OpenSearch HA/ILM production optimization
- Search API parameter contract details (LIN-595)
- Application code implementation details

## 2. Minimum index schema

## 2.1 Index name baseline

- `messages_v0`

## 2.2 Required document fields

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `message_id` | keyword | yes | document id and dedupe key |
| `guild_id` | long | yes | tenancy scope |
| `channel_id` | long | yes | channel filter |
| `author_id` | long | yes | optional filter/audit |
| `content` | text + keyword subfield | yes | full-text query and exact match support |
| `created_at` | date | yes | sorting and range filters |
| `updated_at` | date | yes | replay and freshness checks |
| `is_deleted` | boolean | yes | tombstone visibility control |
| `version` | long | yes | external version conflict guard |

## 2.3 Mapping guardrails

1. `message_id` uniqueness is mandatory.
2. `content` analyzer changes require compatibility review.
3. `version` must be used for conflict-safe updates.

## 3. Ingest path contract

1. Message persist success emits canonical message event.
2. Indexer consumes event and builds search document.
3. Document write uses external version semantics.
4. Version conflict with stale event is dropped and counted.

Source of truth boundary:

- Scylla remains message SoR.
- OpenSearch is derived projection only.

## 4. Eventual consistency and lag policy

Baseline lag viewpoint:

- `P95(search_reflect_lag_seconds) <= 60s` for v0

Required metrics:

- `search_ingest_attempt_total`
- `search_ingest_success_total`
- `search_ingest_error_total`
- `search_reflect_lag_seconds`
- `search_version_conflict_total`

## 5. Reingest policy

## 5.1 Start conditions

Start reingest when any is true:

1. sustained ingest failure rate (`>5%` for 10 minutes)
2. mapping incompatibility corrected and backlog uncertain
3. consistency drift beyond threshold from search runbook verification

## 5.2 Execution baseline

1. Freeze incompatible mapping changes.
2. Select range (incremental first, full only when required).
3. Rebuild docs from Scylla source records.
4. Apply external version writes.
5. Track backlog and drift metrics.

## 5.3 Completion conditions

All must pass:

1. ingest backlog reaches zero
2. sampled mismatch ratio within threshold from search reindex runbook
3. reflect lag returns within target in two consecutive windows

## 6. Failure mode baseline

- OpenSearch unavailable: continue source writes, mark search degraded.
- Ingest transport failure: retry with bounded backoff.
- Mapping failure: stop affected ingest path, escalate, and reingest after correction.

## 7. Operational checklist

1. Verify schema fields and mapping guardrails are unchanged.
2. Verify source-to-index transform includes all required fields.
3. Verify conflict counters and lag metrics are monitored.
4. Verify reingest trigger and completion decisions are auditable.

## 8. Validation checklist

1. Index fields, ingest path, and replay criteria are explicit and non-ambiguous.
2. Outage behavior preserves SoR write continuity.
3. Reingest start/close criteria align with ADR-003 and search reindex runbook.
