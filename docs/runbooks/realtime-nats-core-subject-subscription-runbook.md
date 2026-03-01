# Realtime NATS Core Subject and Subscription Runbook (v0)

- Status: Draft
- Last updated: 2026-03-01
- Owner scope: Realtime v0 baseline
- References:
  - `docs/adr/ADR-002-class-ab-event-classification-and-delivery-boundary.md`
  - `docs/runbooks/edge-rest-ws-routing-drain-runbook.md`
  - `database/contracts/lin589_scylla_sor_partition_baseline.md`
  - `LIN-591`
  - `LIN-593`

## 1. Purpose and scope

This runbook fixes the v0 baseline for NATS Core subject naming and Gateway/Fanout subscription behavior.

In scope:

- Subject naming contract per guild/channel scope
- Gateway subscription and unsubscription lifecycle
- Reconnect and resubscribe baseline
- Failure mode during NATS outage aligned with ADR-002 Class B behavior
- Operational review checklist for adding new subjects

Out of scope:

- JetStream durable stream implementation
- Retry persistence semantics for Class A (v1 scope)
- Application feature implementation changes

## 2. Subject naming contract

## 2.1 Fixed subject template

Use this template for v0 realtime fanout subjects:

- `v0.guild.<guild_id>.channel.<channel_id>.<event>`

Rules:

1. `guild_id` and `channel_id` are decimal numeric IDs.
2. `<event>` uses snake_case and is from an approved event catalog.
3. One event type maps to one unique subject pattern.
4. Wildcard subjects (`>`, `*`) are not allowed in publish paths.

## 2.2 Event catalog baseline

| Event | Subject suffix | Delivery class | Notes |
| --- | --- | --- | --- |
| Message create | `message_create` | Class B | Missing event is compensated by history fetch |
| Typing | `typing_start` / `typing_stop` | Class B | Ephemeral signal, no replay requirement |
| Presence update | `presence_update` | Class B | Ephemeral signal, latest-state bias |

Adding a new event requires updating this runbook and ADR-002 class mapping review.

## 3. Subscription model

## 3.1 Gateway subscription lifecycle

1. On WS auth success, Gateway resolves `(guild_id, channel_id)` visibility set.
2. Gateway creates NATS subscriptions only for visible channels.
3. On channel leave, permission loss, or disconnect, Gateway immediately unsubscribes.
4. On reconnect, Gateway performs full resubscribe from current visibility snapshot.

## 3.2 Fanout behavior

- Fanout publishes exactly one event to the canonical subject from section 2.
- Fanout must not publish duplicate subjects for one logical event.
- Downstream dispatch may deduplicate by `(event_id, subject)` in memory when necessary.

## 3.3 Resubscribe boundary

- Resubscribe does not guarantee replay of missing events.
- Compensation for missing message events is history API refetch (LIN-592 / LIN-593 boundary).

## 4. Performance measurement perspective

Track these required metrics per 5-minute window:

- `nats_publish_total`
- `nats_publish_error_total`
- `nats_publish_latency_ms` (`P50/P95/P99`)
- `gateway_subscriptions_active`
- `gateway_resubscribe_total`
- `gateway_resubscribe_duration_ms` (`P50/P95/P99`)

Baseline SLO viewpoints:

- Publish path: `P95(nats_publish_latency_ms) <= 100ms`
- Resubscribe completion: `P95(gateway_resubscribe_duration_ms) <= 2s`

## 5. Failure mode and outage behavior

## 5.1 NATS unavailable

When NATS Core is unavailable:

1. Keep API write path according to message SoR policy.
2. Treat realtime fanout as degraded (Class B missing allowed by ADR-002).
3. Force reconnecting clients to history fetch path for compensation.
4. Raise incident if outage is longer than 5 minutes.

## 5.2 Recovery

On NATS recovery:

1. Re-establish subscriptions per visibility snapshot.
2. Resume fanout publish to canonical subjects.
3. Verify publish error rate convergence (`< 1%` in two consecutive windows).

## 6. Subject review procedure for new events

Before approving a new subject, all checks are required:

1. Event class mapping in ADR-002 is explicit.
2. Subject template compatibility with section 2 is preserved.
3. Missing-event compensation path is defined.
4. Metrics for publish and subscription impact are identified.
5. Ownership and rollback decision owner are documented.

## 7. Validation checklist

1. `message_create`, `typing`, and `presence` map to unique canonical subjects.
2. Subscribe/unsubscribe lifecycle is deterministic for connect, permission change, and disconnect.
3. NATS outage behavior and compensation path are documented without fail-open ambiguity.
4. Review checklist can be executed without additional undocumented assumptions.
