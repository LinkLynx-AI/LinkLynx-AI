# LIN-589 Scylla SoR / Partition Design Baseline

## Purpose

- Target issue: LIN-589
- Fix a documentation-only operational baseline for Scylla as the message data source of record (SoR).
- Provide stable prerequisites for LIN-592 (History API), LIN-593 (Message path), LIN-594 (Search ingest), and LIN-597 (DR v0).

In scope:

- SoR boundary for `messages`, `message_edits`, and `read_state_hotpath`
- Partition design review criteria for history-first access patterns
- Measurement perspective for latest-N retrieval target (`P95 <= 500ms`)
- Node-loss continuity policy and minimum backup/restore policy

Out of scope:

- CQL schema changes and table additions
- Application/API implementation changes
- Postgres schema or migration changes

## References

- `docs/DATABASE.md`
- `database/scylla/001_lin139_messages.cql`
- `database/contracts/lin287_scylla_primary_key_validation.md`
- `database/contracts/lin288_history_cursor_contract.md`
- `database/contracts/lin289_idempotent_write_contract.md`
- `docs/adr/ADR-002-class-ab-event-classification-and-delivery-boundary.md`
- `docs/runbooks/scylla-node-loss-backup-runbook.md`

## 1. SoR boundary

### 1.1 Responsibility matrix

| Domain | SoR | Primary storage / contract | Notes |
| --- | --- | --- | --- |
| messages body | Scylla | `chat.messages_by_channel` (`database/scylla/001_lin139_messages.cql`) | Main store for channel history retrieval |
| message_edits state | Scylla | `version`, `edited_at`, `is_deleted`, `deleted_at`, `deleted_by` on `chat.messages_by_channel` | v0 manages latest edit/delete state in the same row family |
| read_state_hotpath | Scylla | Scylla-side hotpath read pointer contract for reconnect/history catch-up | Low-latency read path responsibility only |
| read_state durable record (`channel_reads`) | Postgres | `channel_reads`, `upsert_channel_reads_monotonic(...)` | Keep existing Postgres contract; separate from Scylla hotpath responsibility |

### 1.2 Explicit prohibitions

- Do not allow single-partition concentration designs for message history.
- Do not duplicate-write message body to Postgres.
- Do not expand Scylla hotpath responsibilities into full durable account state ownership in LIN-589.

### 1.3 ADR-002 alignment

- Follow ADR-002 as the SSOT for Class A/B outage behavior.
- For Class A message paths, treat fanout uncertainty as possible loss and require history re-fetch/state resync as compensation.

## 2. Partition design review criteria (history-first)

### 2.1 Required key principle

The baseline key design for history retrieval is:

- `PRIMARY KEY ((channel_id, bucket), message_id)`
- `CLUSTERING ORDER BY (message_id DESC)`

Review must reject proposals that break this baseline without providing an approved compatibility path.

### 2.2 Fail conditions (must reject)

Reject design in review when any condition is true:

1. A single partition can grow unbounded for hot channels without bucket split strategy.
2. Latest-N retrieval requires full-scan or ambiguous filtering across uncontrolled partitions.
3. Cursor paging cannot preserve deterministic ordering and duplicate exclusion defined by LIN-288.
4. Idempotent create path cannot preserve duplicate no-op behavior defined by LIN-289.

### 2.3 Required pre-estimation items

Before approving partition design, document all items below:

1. Estimated rows per bucket (`messages / bucket`)
2. Estimated partition size per bucket (bytes)
3. Hot-channel skew estimate (top channel concentration)
4. Cross-bucket read frequency for history pagination

If any item is missing, review is not complete.

### 2.4 Latest-N measurement perspective

Baseline measurement setup:

- Default `N = 50`
- Measure `P50 / P95 / P99` latency for latest-N retrieval
- Measure on hot-channel assumed load scenario (same input profile used in partition review)
- Use fixed windows and record sample count per window

Target and recording rule:

- Target: `P95 <= 500ms`
- Record pass/fail decision with window, sample count, and query path used

This is a review target for LIN-589 baseline, not a guarantee of all future workloads.

## 3. Node-loss continuity baseline

### 3.1 Continuation rule

Continue service when all are true:

1. One node loss is detected, but quorum for required consistency remains available.
2. History read path remains healthy enough for compensation re-fetch.
3. No data divergence signal is detected in critical message paths.

### 3.2 Non-continuation rule

If quorum is not maintained or cluster state is uncertain:

- Treat write paths as fail-close and prioritize recovery.
- Keep only safe read paths if they do not violate consistency expectations.
- Resume writes only after recovery gates are satisfied.

Detailed operation steps are defined in:

- `docs/runbooks/scylla-node-loss-backup-runbook.md`

## 4. Minimum backup / restore policy

Minimum required artifacts:

1. Snapshot data for `chat` keyspace
2. Keyspace/table schema snapshot
3. Backup execution record (time window, scope, owner)

Minimum restore policy:

1. Prepare restore target and schema first.
2. Restore snapshot data.
3. Validate data and query health.
4. Resume read-first, then write paths.

Detailed operational steps and close conditions are defined in the Scylla runbook.

## 5. Verification points (review procedure)

1. SoR boundary and table responsibilities are explicitly documented.
2. Prohibited patterns (single partition concentration, Postgres message dual-write) are explicitly documented.
3. Latest-N measurement method and `P95 <= 500ms` target are documented.
4. Node-loss continuation/non-continuation gates are unambiguous.
5. Minimum backup/restore procedure is reproducible from docs only.
