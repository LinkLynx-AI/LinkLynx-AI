# Observability v0 Structured Logs and Metrics Runbook

- Status: Draft
- Last updated: 2026-03-01
- Owner scope: Observability minimum baseline (v0)
- References:
  - `docs/runbooks/edge-rest-ws-routing-drain-runbook.md`
  - `docs/runbooks/auth-firebase-principal-operations-runbook.md`
  - `docs/runbooks/message-persist-publish-dispatch-runbook.md`
  - `docs/adr/ADR-005-dragonfly-ratelimit-failure-policy.md`
  - `LIN-596`

## 1. Purpose and scope

This runbook fixes the minimum observability baseline for v0 operations.

In scope:

- Structured log field standard
- Minimum metrics for API/WS/DB/NATS
- Dashboard minimum panels for SLO tracking
- Alert candidates for early incident detection

Out of scope:

- Loki/Tempo/Sentry full integration
- Product analytics expansion
- UI observability implementation

## 2. Structured log standard

## 2.1 Required common fields

Every request/event log must include:

- `timestamp`
- `level`
- `service`
- `request_id`
- `trace_id` (when available)
- `principal_id` (nullable before auth)
- `guild_id` (nullable)
- `channel_id` (nullable)
- `event_name`
- `outcome`

## 2.2 Stage-specific required fields

API logs:

- `http_method`, `path`, `status_code`, `latency_ms`

WS logs:

- `connection_id`, `ws_event`, `close_code`, `session_id`

DB logs:

- `db_system`, `operation`, `table`, `duration_ms`, `error_class`

NATS logs:

- `subject`, `publish_or_consume`, `duration_ms`, `delivery_result`

## 3. Minimum metrics set

## 3.1 API

- `api_request_total{route,status}`
- `api_request_latency_ms_bucket{route}`
- `api_error_total{route,error_class}`

## 3.2 WS

- `ws_connections_active`
- `ws_reconnect_total`
- `ws_disconnect_total{reason}`
- `ws_dispatch_latency_ms_bucket`

## 3.3 DB (Postgres/Scylla)

- `db_query_total{db,operation}`
- `db_query_latency_ms_bucket{db,operation}`
- `db_timeout_total{db}`

## 3.4 NATS

- `nats_publish_total{subject}`
- `nats_publish_error_total{subject}`
- `nats_publish_latency_ms_bucket{subject}`

## 4. Dashboard minimum panels

Required dashboard panels:

1. API success/error rate and latency (`P95/P99`)
2. WS active connections and disconnect reasons
3. Message path stage latency (accept/persist/publish/dispatch)
4. DB timeout and error trends (Postgres + Scylla)
5. NATS publish error/latency by subject group
6. Search reflect lag and degraded response count

## 5. Alert candidate baseline

High-priority candidates:

- API error rate > 5% for 5 minutes
- WS disconnect surge > 2x baseline for 10 minutes
- DB timeout burst above threshold for 5 minutes
- NATS publish error rate > 3% for 5 minutes

Medium-priority candidates:

- P95 latency regression > 2x baseline for 15 minutes
- Search degraded response sustained > 10 minutes

## 6. Incident triage with logs/metrics

1. Identify impacted path using service-level error and latency panels.
2. Correlate `request_id` and `trace_id` across API/WS/DB/NATS logs.
3. Confirm first-failure stage and dependency health.
4. Validate whether compensation path is functioning.
5. Record mitigation and rollback decision owner.

## 7. Validation checklist

1. Required structured fields are defined and stage-specific fields are complete.
2. API/WS/DB/NATS all have minimum metrics to track errors and latency.
3. Dashboard panels can show P95/P99 and incident trend.
4. Alert candidates are concrete enough for immediate rule creation.
