# Tracing v0 Runbook (send -> persist -> fanout -> dispatch)

- Status: Draft
- Last updated: 2026-03-01
- Owner scope: v0 distributed tracing baseline
- References:
  - `docs/runbooks/message-persist-publish-dispatch-runbook.md`
  - `docs/runbooks/observability-v0-structured-logs-metrics-runbook.md`
  - `LIN-598`

## 1. Purpose and scope

This runbook fixes the v0 tracing baseline for one message flow:

- API send
- Scylla persist
- NATS fanout publish
- Gateway dispatch

In scope:

- Span boundaries
- Required span attributes
- Log/trace correlation rule
- Trace overhead monitoring viewpoint

Out of scope:

- Full product-wide tracing coverage
- Vendor-specific collector deployment details
- v1 advanced sampling strategy

## 2. Trace model baseline

## 2.1 Root span

- `message.send.request`
- starts at API request entry
- ends at sender ACK response

## 2.2 Child spans

| Span name | Stage | Start condition | End condition |
| --- | --- | --- | --- |
| `message.persist.scylla` | persist | write request emitted | write result received |
| `message.fanout.nats_publish` | fanout | publish request emitted | publish ack/error received |
| `message.dispatch.gateway_enqueue` | dispatch | event received by gateway | enqueue complete/fail |
| `message.dispatch.gateway_send` | dispatch | websocket send starts | send success/fail/timeout |

## 3. Required span attributes

Common attributes (all spans):

- `request_id`
- `trace_id`
- `message_id`
- `guild_id`
- `channel_id`
- `principal_id` (if available)
- `outcome`

Stage-specific attributes:

- persist: `db.system=scylla`, `db.operation=insert`, `db.timeout_ms`
- fanout: `messaging.system=nats`, `messaging.destination`, `retry_count`
- dispatch: `ws.connection_id`, `ws.close_code` (if closed), `queue_depth`

## 4. Log and trace correlation rule

1. Every stage log must include `trace_id` and `request_id`.
2. Error logs must include span name and stage outcome.
3. Incident analysis starts from `trace_id` and expands to all stage logs.

## 5. Sampling and overhead viewpoint

v0 baseline:

- 100% sample for error traces
- baseline sample for success traces (configurable)

Required overhead metrics:

- `trace_export_queue_size`
- `trace_export_error_total`
- `trace_overhead_latency_ms`

Guardrail:

- tracing overhead should not increase message send `P95` by more than 10% over baseline window.

## 6. Failure mode expectations

- Missing span from one stage must be detectable via log correlation.
- Trace backend outage must not block message path (best-effort export).
- When export fails, increment failure metrics and keep local log evidence.

## 7. Operational troubleshooting checklist

1. Pick one `message_id` and confirm all mandatory spans exist.
2. Verify stage order (`persist` before `fanout`, `fanout` before `dispatch`).
3. Verify attributes include required IDs and outcome.
4. Verify trace/log correlation is possible from single `trace_id`.
5. Verify export health and overhead trend before/after tracing enablement.

## 8. Validation checklist

1. Span boundaries are deterministic and map to message shortest path.
2. Required attributes are complete enough for incident triage.
3. Trace export failure does not degrade core message durability.
4. Overhead monitoring is defined with concrete guardrail.
