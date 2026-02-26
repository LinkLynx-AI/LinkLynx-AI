# ADR-002 Class A/B Event Classification and Delivery Boundary

- Status: Accepted
- Date: 2026-02-26
- Related:
  - [LIN-581](https://linear.app/linklynx-ai/issue/LIN-581)
  - [LIN-580](https://linear.app/linklynx-ai/issue/LIN-580)
  - [LIN-591](https://linear.app/linklynx-ai/issue/LIN-591)
  - [LIN-593](https://linear.app/linklynx-ai/issue/LIN-593)
  - [LIN-599](https://linear.app/linklynx-ai/issue/LIN-599)
  - [ADR-001](./ADR-001-event-schema-compatibility.md)

## Context

LIN-581 requires one shared operating rule for event delivery so v0 and v1 can use the same
classification language and avoid ad-hoc decisions.
Without a fixed Class A/B table and platform boundary, API/Gateway/Consumer implementations can
diverge in outage handling and replay expectations.

## Decision

### 1. Class definitions

- Class A:
  - Loss is not acceptable.
  - Event affects durable state transitions.
  - When delivery is uncertain, recovery and resynchronization are mandatory.
- Class B:
  - Loss is acceptable.
  - Event is mainly UX-assistive or ephemeral.
  - Re-send/replay is optional and should not block core flow.

### 2. Fixed event classification table (v0 baseline)

| event | class | v0_transport | v1_transport | nats_outage_behavior | recovery_path | owner_component |
| --- | --- | --- | --- | --- | --- | --- |
| `message_create` | Class A | NATS Core (best effort fanout) | JetStream durable stream (source), optional derived export | Treat as potentially dropped; do not assume fanout success | Mandatory history re-fetch and state resync | API + Gateway + Consumer |
| `typing` | Class B | NATS Core (ephemeral) | NATS Core ephemeral path; optional derived stream for extensions | Drop is acceptable; no blocking retry | No mandatory replay; next user action naturally heals UX | Gateway |
| `role_change` | Class A | NATS Core (best effort fanout) | JetStream durable stream (source), optional derived export | Treat as potentially dropped due to authorization impact | Mandatory permission state re-fetch and session resync | API + Consumer |

This table is the single source of truth (SSOT) for class decisions in v0.

### 3. v0/v1 delivery boundary

- v0 boundary:
  - Operate on NATS Core centered, low-latency best-effort delivery.
  - Compensate uncertain delivery with history/state re-fetch for Class A paths.
- v1 boundary:
  - Class A moves to JetStream durability and controlled replay/retry.
  - Redpanda is treated as an extension stream path and kept separate from Class A durability
    guarantees.
- Non-goal in LIN-581:
  - No JetStream or Redpanda implementation work starts in this issue.

### 4. Outage responsibilities by component

- API responsibilities:
  - Assign and document class at event-definition time.
  - For Class A, expose or preserve enough cursor/version data for re-fetch.
- Gateway responsibilities:
  - Class A: detect potential delivery gaps and guide clients to re-fetch/resync.
  - Class B: allow graceful degradation without mandatory replay flow.
- Consumer responsibilities:
  - Apply idempotent processing.
  - Follow class-specific handling: strict recovery path for Class A, non-blocking handling for
    Class B.

### 5. Mandatory checklist for new events

Every new event proposal must include:

1. Class selection (`Class A` or `Class B`)
2. Classification rationale
3. Expected behavior during NATS/Core outage
4. Recovery requirement (`mandatory`, `optional`, or `none`) and concrete method
5. Owner component (`API`, `Gateway`, `Consumer`, or combined)

Events without class selection are not review-ready.

## Operational usage

- API/Gateway/Consumer documents must reference this ADR for class decisions.
- Schema compatibility decisions remain governed by ADR-001; this ADR governs delivery class and
  outage behavior.
- Follow-up issues that define delivery, replay, or realtime contracts must link this ADR.

## Consequences

- Class assignment for new events can be decided directly from one table within minutes.
- Outage handling becomes predictable by class.
- v0 NATS Core operations and v1 durable messaging scope stay explicitly separated.
