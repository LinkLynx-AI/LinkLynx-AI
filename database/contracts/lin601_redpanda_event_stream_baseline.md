# LIN-601 Redpanda Event Stream Baseline (Topic Naming / Retention / Replay Operations)

## Purpose

- Target issue: LIN-601
- Fix the v1 Event Stream baseline for Redpanda topic naming, retention, replay, and change operations.
- Provide one backend contract that LIN-603 (ClickHouse ingest) and LIN-604 (Search Ops) can consume.

In scope:

- Topic naming rules and examples
- Topic class separation (Class A extension mirror vs derived streams)
- Retention and partition baseline
- Replay/reprocess operation rules
- Broker outage and data-preservation baseline
- Topic add/change procedure baseline and runbook linkage

Out of scope:

- Redpanda cluster provisioning and deployment automation
- Runtime producer/consumer implementation
- JetStream durability implementation details (LIN-599 scope)

## References

- `docs/adr/ADR-001-event-schema-compatibility.md`
- `docs/adr/ADR-002-class-ab-event-classification-and-delivery-boundary.md`
- `database/contracts/lin139_runtime_contracts.md`
- `docs/runbooks/redpanda-topic-retention-replay-runbook.md`
- `LIN-599`, `LIN-603`, `LIN-604`

## 1. Delivery boundary and responsibility split

1. Class A durability source remains JetStream (ADR-002 / LIN-599 baseline).
2. Redpanda is an extension stream path for replay/analytics/search operations.
3. A Redpanda outage must not redefine Class A ownership or convert Redpanda into SoR.
4. Producer-side write path must not block core message persistence solely on Redpanda unavailability.

## 2. Topic naming contract

### 2.1 Naming format

- Topic format:
  - `llx.<env>.v1.<plane>.<domain>.<event>.<schema_major>`
- Constraints:
  - lowercase letters, digits, and dot only
  - no dynamic tenant IDs in topic name
  - `schema_major` is fixed form `v<integer>`

### 2.2 Plane definitions

- `plane = durable`:
  - mirror/export path for Class A recovery-oriented streams
  - not the primary durability authority
- `plane = derived`:
  - downstream operational streams (audit/search rebuild/etc.)

### 2.3 Naming examples

| use case | topic |
| --- | --- |
| Class A export mirror (`message_create`) | `llx.prod.v1.durable.message.message_create.v1` |
| Audit ingest feed | `llx.prod.v1.derived.audit.message_events.v1` |
| Search rebuild feed | `llx.prod.v1.derived.search.message_projection.v1` |

## 3. Retention and partition baseline

| topic class | retention baseline | partition baseline | cleanup policy | notes |
| --- | --- | --- | --- | --- |
| `durable.*` (Class A extension mirror) | `168h` (7d) | minimum `12` | `delete` | replay window for incident recovery |
| `derived.audit.*` | `720h` (30d) | minimum `24` | `delete` | feeds LIN-603 append-only analytics path |
| `derived.search.*` | `336h` (14d) | minimum `12` | `delete` | supports LIN-604 reindex/catch-up |
| compacted control topics (optional) | `720h` | minimum `3` | `compact,delete` | only for checkpoints/offset control |

Partition sizing review inputs:

- expected peak ingress messages/sec
- message size p50/p95
- consumer parallelism and lag recovery target
- partition skew (`max_partition_rate / avg_partition_rate`)

## 4. Replay/reprocess operation contract

1. Replay uses a dedicated consumer group:
   - `replay.<ticket_or_incident>.<yyyymmddhhmm>`
2. Replay range must be explicit:
   - start/end by timestamp or offset
3. Production serving groups must not be offset-reset directly for ad-hoc replay.
4. Idempotency keys must remain stable across replay:
   - `event_id` and domain key (`message_id + version`) where applicable
5. Replay result must record:
   - target topics, time range, consumed volume, success/failure counts, lag convergence time

## 5. Broker outage and data-preservation baseline

### 5.1 Outage posture

- Redpanda unavailable:
  - core write path continues per ADR-002/LIN-599 baseline
  - extension consumers enter degraded mode
  - replay and derived downstream processing are paused or delayed

### 5.2 Recovery posture

1. Verify broker health and ISR stability.
2. Confirm retention window still covers outage range.
3. Resume consumers in priority order:
   - audit (`derived.audit.*`) -> search (`derived.search.*`) -> optional backfill jobs
4. If retention window is insufficient, execute Scylla-based corrective rebuild path.

### 5.3 Data-preservation guardrails

- Keep `under_replicated_partitions = 0` as target steady state.
- No untracked manual deletion on Redpanda topics in production.
- Topic retention reduction requires rollback-ready change record (runbook section 7/8).

## 6. Throughput and lag evaluation viewpoints

Minimum operational metrics for LIN-601 baseline:

- broker ingest:
  - `bytes_in_per_sec`
  - `records_in_per_sec`
- broker health:
  - `under_replicated_partitions`
  - `offline_partitions_count`
- producer quality:
  - produce success rate
  - produce latency p95/p99
- consumer quality:
  - per-group lag
  - replay catch-up duration

Baseline evaluation targets (initial, adjustable by follow-up operations review):

- produce success rate `>= 99.9%` (5-minute window)
- produce latency p95 `<= 50ms`
- no sustained under-replicated partitions beyond 2 minutes
- replay catch-up reports include throughput and lag convergence evidence

## 7. Topic add/change operation baseline

- Topic add/change operations must follow:
  - `docs/runbooks/redpanda-topic-retention-replay-runbook.md`
- Mandatory control points:
  1. naming review against section 2
  2. retention/partition review against section 3
  3. rollback plan before apply
  4. post-change validation and incident-ready evidence

## 8. Acceptance criteria mapping (LIN-601)

| LIN-601 acceptance criterion | Coverage |
| --- | --- |
| Functional: define topic naming/retention/reprocess flow | sections 2, 3, 4 |
| Performance: define throughput evaluation viewpoints | section 6 |
| Outage: define outage recovery and data-preservation policy | section 5 |
| Operations: define topic add/change procedure | section 7 + runbook |

## 9. ADR-001 compatibility checklist result

Result: PASS / N.A. (no event payload schema shape change in this issue)

- Additive-only schema rule: N.A. (operational contract only)
- Consumer impact: no wire-contract mutation introduced here
- Monitoring/rollback readiness: covered by sections 5/6 and runbook linkage
- Documentation update scope: contract + runbook + index links are updated together
