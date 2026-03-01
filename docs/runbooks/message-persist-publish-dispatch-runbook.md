# Message Shortest Path Runbook (persist -> publish -> dispatch, v0)

- Status: Draft
- Last updated: 2026-03-01
- Owner scope: Message delivery v0 baseline
- References:
  - `docs/runbooks/realtime-nats-core-subject-subscription-runbook.md`
  - `docs/runbooks/session-resume-dragonfly-operations-runbook.md`
  - `docs/runbooks/scylla-node-loss-backup-runbook.md`
  - `docs/adr/ADR-002-class-ab-event-classification-and-delivery-boundary.md`
  - `LIN-593`

## 1. Purpose and scope

This runbook fixes the v0 shortest message path contract:

- API accept
- Scylla persist
- NATS publish
- Gateway dispatch

In scope:

- Responsibility boundaries for each stage
- ACK timing and missing-delivery compensation policy
- Backpressure handling and disconnect/drop criteria
- Measurement viewpoints for v0 latency targets

Out of scope:

- JetStream durable delivery implementation
- Message edit/delete feature details beyond shortest path
- UI behavior implementation

## 2. Stage contract and ownership

| Stage | Owner | Input | Output | Failure classification |
| --- | --- | --- | --- | --- |
| API accept | API service | authenticated request + validated payload | accepted command with `message_id` | request validation/auth failure |
| Persist | Scylla write path | accepted command | durable row in message SoR | write timeout/unavailable |
| Publish | Fanout publisher | persisted event | NATS event on canonical subject | broker unavailable/publish error |
| Dispatch | Gateway | subscribed event | WS push attempt to connected members | connection/backpressure issue |

Fixed ordering rule:

1. Persist must complete before publish.
2. Publish must happen before dispatch observation.
3. Dispatch failure does not invalidate persisted message.

## 3. ACK and compensation boundary

## 3.1 ACK contract

- Server ACK means "persist completed".
- ACK does not guarantee all recipients already received WS dispatch.
- ACK payload must include `message_id`, `channel_id`, `persisted_at`.

## 3.2 Missing delivery compensation

When dispatch is missing or uncertain:

1. Client reconnect or resume fallback triggers history fetch.
2. History API is the compensation source of truth.
3. Server must never synthesize missing history from transient dispatch state.

## 4. Backpressure policy

## 4.1 Detection signals

Required signals per connection:

- outbound queue length
- send loop lag
- repeated write timeout count

## 4.2 Threshold baseline

- Warning: queue length > 100 messages for 10s
- Critical: queue length > 500 messages or send lag > 5s for 30s

## 4.3 Actions

1. Warning zone:
- apply send-rate reduction and telemetry tagging.
2. Critical zone:
- close WS connection with retry guidance.
- do not drop persisted data.
- force compensation path through history fetch on reconnect.

## 5. Latency measurement viewpoint

Track every stage with request correlation (`request_id`, `trace_id`, `message_id`):

- API accept latency
- persist latency
- publish latency
- dispatch enqueue latency

v0 target viewpoints:

- Send `P95 <= 500ms` (API accept to persist ACK)
- Dispatch `P95 <= 800ms` (persist complete to dispatch enqueue)

These are operational acceptance viewpoints, not strict SLO guarantees for every condition.

## 6. Failure mode policy

## 6.1 Persist failure

- Return error to sender.
- No publish and no dispatch attempt.

## 6.2 Publish failure after persist success

- Keep persisted record as committed truth.
- Mark publish failure metric and incident signal.
- Rely on history compensation for clients that miss realtime event.

## 6.3 Dispatch failure after publish success

- Keep publish outcome unchanged.
- Close or recycle unhealthy connections based on backpressure policy.
- Rely on reconnect + history fetch compensation.

## 7. Operational triage checklist

1. Correlate one `message_id` across accept/persist/publish/dispatch logs.
2. Confirm stage where first failure occurs.
3. Confirm compensation path availability (History API health).
4. Confirm backpressure thresholds are applied deterministically.
5. Record incident scope (single channel vs broad broker/service impact).

## 8. Validation checklist

1. Stage ownership and ordering are unambiguous.
2. ACK boundary is explicit and does not over-promise dispatch success.
3. Backpressure thresholds and close criteria are concrete.
4. Missing delivery compensation is consistently defined as history fetch.
5. Latency measurement points can produce `P95` for send/dispatch viewpoints.
