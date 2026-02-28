# Redpanda Topic Retention and Replay Operations Runbook (LIN-601)

- Status: Draft
- Last updated: 2026-02-28
- Owner scope: v1 Event Stream operation baseline
- References:
  - [ADR-001 Event Schema Compatibility Rules (Additive Changes Only)](../adr/ADR-001-event-schema-compatibility.md)
  - [ADR-002 Class A/B Event Classification and Delivery Boundary](../adr/ADR-002-class-ab-event-classification-and-delivery-boundary.md)
  - [LIN-601 Redpanda Event Stream Baseline](../../database/contracts/lin601_redpanda_event_stream_baseline.md)
  - [LIN-603](https://linear.app/linklynx-ai/issue/LIN-603)
  - [LIN-604](https://linear.app/linklynx-ai/issue/LIN-604)

## 1. Purpose and scope

This runbook defines operational steps for Redpanda topic creation/change, retention updates, and replay execution under LIN-601.

In scope:

- Topic create/update pre-check and apply sequence
- Retention/partition change validation and rollback baseline
- Replay execution flow and evidence requirements
- Outage response and recovery sequence for stream continuity

Out of scope:

- Cluster provisioning (IaC/helm/controller)
- Application-level producer/consumer implementation
- JetStream durability behavior design

## 2. Required placeholders

Before execution, fill environment-specific values:

| key | staging placeholder | production placeholder |
| --- | --- | --- |
| Redpanda bootstrap servers | `<stg_bootstrap_servers>` | `<prod_bootstrap_servers>` |
| admin endpoint | `<stg_admin_endpoint>` | `<prod_admin_endpoint>` |
| topic namespace prefix | `llx.stg.v1` | `llx.prod.v1` |
| on-call channel | `<stg_oncall_channel>` | `<prod_oncall_channel>` |
| operation ticket | `<stg_ticket_id>` | `<prod_ticket_id>` |

## 3. Pre-check before topic add/change

All checks are mandatory.

1. Confirm target topic name follows LIN-601 naming contract:
   - `llx.<env>.v1.<plane>.<domain>.<event>.<schema_major>`
2. Confirm topic plane/class and downstream owner:
   - `durable` or `derived`
3. Confirm retention/partition values are reviewed against throughput and lag expectations.
4. Confirm rollback plan:
   - previous retention/partition values
   - expected impact and rollback trigger
5. Confirm monitoring dashboards/alerts are available for:
   - produce success rate
   - under-replicated partitions
   - consumer lag

Do not apply changes if any pre-check is missing.

## 4. Topic add/change procedure

### 4.1 Create new topic

1. Create topic with explicit partition count and retention.
2. Verify metadata propagation on all brokers.
3. Validate cleanup policy (`delete` or `compact,delete`) against LIN-601 section 3.
4. Record operation log:
   - operator
   - ticket
   - timestamp
   - topic config snapshot

### 4.2 Change existing topic (retention/partition)

1. Capture current topic config snapshot.
2. Apply one class of change at a time:
   - retention change first, then partition change if needed
3. Validate post-change metrics for at least 10 minutes.
4. If thresholds fail, execute rollback immediately.

## 5. Replay operation procedure

### 5.1 Start criteria

Start replay only when both are true:

1. Replay target range and reason are explicitly documented.
2. Idempotency strategy for affected consumers is confirmed.

### 5.2 Replay execution

1. Create dedicated replay consumer group:
   - `replay.<ticket_or_incident>.<yyyymmddhhmm>`
2. Set replay range (timestamp or offset range).
3. Execute replay with bounded throughput control.
4. Track:
   - consumed records
   - error count
   - lag convergence over time

### 5.3 Completion criteria

All must pass:

1. replay consumer lag reaches `0` and remains stable for 2 consecutive checks.
2. no critical consumer processing failure remains unresolved.
3. operation report is recorded with volume/range/outcome.

## 6. Outage response and recovery

### 6.1 Broker outage (degraded mode)

1. Announce degraded mode to on-call channel.
2. Confirm core write-path continuity posture (ADR-002/LIN-599 baseline).
3. Pause non-critical replay and heavy derived consumers if needed.
4. Track outage start time and affected topics.

### 6.2 Recovery sequence

1. Confirm broker health and ISR stability restored.
2. Check retention coverage for outage window.
3. Resume consumers in priority order:
   - `derived.audit.*`
   - `derived.search.*`
   - optional replay jobs
4. If retention coverage is insufficient, trigger Scylla-based rebuild fallback and log the decision.

## 7. Validation checklist after change

1. Produce success rate `>= 99.9%` in 5-minute windows.
2. `under_replicated_partitions = 0` sustained after stabilization.
3. No unexpected consumer lag growth after change.
4. Topic config snapshot before/after is archived in ticket.

## 8. Rollback policy

Rollback immediately when any condition is true:

1. under-replicated/offline partitions persist beyond agreed threshold.
2. produce error spike persists for 2 consecutive windows.
3. consumer lag grows continuously without convergence.
4. topic configuration drift is detected against approved plan.

Rollback actions:

1. restore previous topic retention/partition config.
2. confirm producer/consumer health recovery.
3. publish incident summary and follow-up action list.

## 9. Acceptance checklist (LIN-601 mapping)

1. Functional:
   - Naming/retention/replay execution sequence is documented.
2. Performance:
   - Throughput and lag validation checkpoints are explicit.
3. Outage handling:
   - Outage response and recovery order are unambiguous.
4. Operations:
   - Topic add/change and rollback steps are documented.
