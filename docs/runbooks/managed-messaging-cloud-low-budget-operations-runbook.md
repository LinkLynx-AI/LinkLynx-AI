# Managed Messaging Cloud Low-budget Operations Runbook

- Status: Draft
- Last updated: 2026-03-29
- Owner scope: low-budget `prod-only` Redpanda Cloud / Synadia Cloud ops baseline
- References:
  - [ADR-002 Class A/B Event Classification and Delivery Boundary](../adr/ADR-002-class-ab-event-classification-and-delivery-boundary.md)
  - [LIN-601 Redpanda Event Stream Baseline](../../database/contracts/lin601_redpanda_event_stream_baseline.md)
  - [Realtime NATS Core Subject and Subscription Runbook (v0)](./realtime-nats-core-subject-subscription-runbook.md)
  - [Redpanda Topic Retention and Replay Operations Runbook](./redpanda-topic-retention-replay-runbook.md)
  - [Managed Messaging Low-budget Operations Runbook](./managed-messaging-low-budget-operations-runbook.md)

## 1. Purpose and scope

This runbook defines the low-budget `prod-only` operating baseline for managed messaging after
connection material has been reserved in Secret Manager.

In scope:

- provider responsibility and LinkLynx responsibility split
- low-budget operating boundary for Redpanda Cloud and Synadia Cloud
- incident triage and monitoring seed
- credential rotation and replay ownership boundary

Out of scope:

- Redpanda Cloud or Synadia Cloud account provisioning
- runtime client wiring in API / Gateway / workers
- publish / subscribe smoke tests
- network / allowlist / private connectivity setup
- full standard operating model that belongs to `LIN-971`

## 2. Hosting baseline

- Low-budget path uses `Redpanda Cloud` for v1 extension stream operations.
- Low-budget path uses `Synadia Cloud` for managed NATS connectivity.
- Secret inventory is created first by `LIN-1024`.
- Runtime clients are allowed to stay unimplemented at this stage; this issue closes only the
  ownership and ops boundary after inventory exists.
- Managed provider control planes are treated as vendor-owned dependencies, not Terraform-owned
  infrastructure in the low-budget path.

## 3. Responsibility split

| Area | Vendor | LinkLynx |
| --- | --- | --- |
| Managed control plane availability | owns | monitors status and opens incident |
| Broker/account lifecycle inside the provider portal | hosts | requests changes and records change intent |
| Topic naming / retention / replay rules | no | owns via LIN-601 and runbooks |
| NATS subject naming / reconnect behavior | no | owns via ADR-002 and realtime runbook |
| Credential material storage | no | owns via Secret Manager baseline |
| Credential rotation timing | no | owns |
| Core write-path continuity during messaging outage | no | owns per ADR-002 |
| Replay / rebuild decision after durable-stream delay | no | owns |

## 4. Operational baseline

### 4.1 Redpanda Cloud

- Treat Redpanda as an extension stream path, not the source of truth.
- Keep topic naming / retention / replay decisions aligned with `LIN-601`.
- A Redpanda outage must not block the core write path by itself.
- Replay work must use a dedicated replay consumer group and bounded replay range.
- If retention is insufficient after an outage, switch to the Scylla-backed corrective rebuild path
  instead of redefining Redpanda as the recovery source.

### 4.2 Synadia Cloud / NATS

- Treat NATS as the realtime fanout path governed by ADR-002 and the realtime subject runbook.
- On NATS outage, keep write-path continuity and treat realtime delivery as degraded.
- Class A paths must compensate by history refetch / state resync; Class B paths may drop.
- Keep canonical subject naming and avoid wildcard publish paths.
- Reconnect / resubscribe behavior remains owned by Gateway-side runtime logic, even when the
  service is vendor-managed.

### 4.3 Credential baseline

- Keep all Redpanda / NATS connection material in Secret Manager.
- Rotate credentials by adding a new secret version first.
- Do not store long-lived credentials in GitHub variables, repository files, or Terraform values.
- Runtime adoption of rotated credentials is a follow-up concern for `LIN-971`.

## 5. Monitoring seed

Low-budget path should at minimum observe these signals.

### Redpanda seed

- producer success / error rate
- producer latency `P95 / P99`
- consumer group lag (`max` / `sum`)
- active consumer count for serving groups
- under-replicated or unhealthy partition indicators when surfaced by the provider

### NATS seed

- connection/auth error rate
- publish error count / rate
- reconnect / resubscribe count and duration
- active subscription count drift against expected serving topology
- provider status / service incident indicator

Suggested first alert seeds:

- Redpanda consumer lag keeps growing without convergence
- Redpanda produce success rate drops below target for two consecutive windows
- NATS publish errors or reconnect duration stay elevated beyond a short maintenance window
- credential rotation introduces auth failures after rollout

## 6. Incident triage baseline

Classify the incident before taking action.

1. Redpanda durable extension degradation
- Symptoms: consumer lag grows, replay jobs stall, produce or fetch quality degrades.
- Immediate posture: keep core write path running, confirm retention coverage, pause optional replay.
- Next action: use the Redpanda replay runbook and record whether corrective rebuild is required.

2. NATS realtime degradation
- Symptoms: connection/auth failures, reconnect storms, fanout publish errors, subscription drift.
- Immediate posture: degrade realtime, keep write path running, force compensation through history
  fetch for Class A user flows.
- Next action: verify canonical subject usage, reconnect behavior, and provider status.

3. Credential / rotation incident
- Symptoms: auth failures immediately after secret update or client rollout.
- Immediate posture: roll back to the previous secret version or disable the bad version.
- Next action: record which future runtime consumers still need to adopt the rotated credential.

## 7. Handoff boundary to standard path

Keep the following in `LIN-971`:

- actual Redpanda / NATS client wiring
- publish / subscribe smoke tests
- network / allowlist / auth onboarding path
- provider resource provisioning or reproducible account bootstrap
- full observability implementation that scrapes provider metrics into the chosen monitoring stack
