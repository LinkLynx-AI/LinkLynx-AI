# Edge REST/WS Routing and WS Drain Runbook (Draft)

- Status: Draft
- Last updated: 2026-03-27
- Owner scope: Edge routing and realtime connection continuity baseline for v0
- References:
  - [ADR-002 Class A/B Event Classification and Delivery Boundary](../adr/ADR-002-class-ab-event-classification-and-delivery-boundary.md)
  - [ADR-005 Dragonfly Outage RateLimit Failure Policy (Hybrid)](../adr/ADR-005-dragonfly-ratelimit-failure-policy.md)
  - [ADR-006 Phase 1 Edge Baseline on GCP Native Edge](../adr/ADR-006-phase1-edge-baseline-gcp-native-edge.md)
  - [LIN-585](https://linear.app/linklynx-ai/issue/LIN-585)
  - [LIN-586](https://linear.app/linklynx-ai/issue/LIN-586)
  - [LIN-587](https://linear.app/linklynx-ai/issue/LIN-587)
  - [LIN-591](https://linear.app/linklynx-ai/issue/LIN-591)
  - [LIN-596](https://linear.app/linklynx-ai/issue/LIN-596)

## 1. Purpose and scope

This runbook fixes one operational baseline for REST/WS edge routing and rolling-update WS drain in v0.

In scope:

- Cloud DNS -> GCLB (+ Cloud Armor, optional Cloud CDN) -> GKE Ingress -> API routing contract for REST and WS
- Health check contract and routing dependencies
- WS drain behavior during rollout
- Failure handling and rollback procedure for LB/Ingress path
- 10,000 concurrent-connection validation procedure and pass/fail thresholds

Out of scope:

- WebTransport migration
- v1 advanced WAF tuning and implementation details
- Runtime infrastructure changes (Terraform/Helm/controller rollout implementation)

## 2. Environment placeholders

Do not hardcode environment-specific values in this runbook.
Fill the placeholders below before each rollout.

| key | staging placeholder | production placeholder |
| --- | --- | --- |
| Cloud DNS managed zone | `<stg_dns_zone>` | `<prod_dns_zone>` |
| Public API host | `<stg_api_host>` | `<prod_api_host>` |
| Public WS host | `<stg_ws_host>` | `<prod_ws_host>` |
| Certificate Manager certificate | `<stg_cert_name>` | `<prod_cert_name>` |
| GCLB backend service | `<stg_gclb_backend_service>` | `<prod_gclb_backend_service>` |
| GCLB health check name | `<stg_gclb_health_check>` | `<prod_gclb_health_check>` |
| Ingress namespace/name | `<stg_ingress_namespace>/<stg_ingress_name>` | `<prod_ingress_namespace>/<prod_ingress_name>` |
| API service name/port | `<stg_api_service>:<stg_api_port>` | `<prod_api_service>:<prod_api_port>` |

## 3. Routing contract (REST and WS)

### 3.1 Fixed request paths

| protocol | client scheme | edge path | app endpoint | expected behavior |
| --- | --- | --- | --- | --- |
| REST | `https://` | Cloud DNS -> GCLB (+ Cloud Armor, optional Cloud CDN) -> GKE Ingress | `GET /health` and API REST paths | Path remains available when at least one backend is healthy |
| WebSocket | `wss://` | Cloud DNS -> GCLB (+ Cloud Armor) -> GKE Ingress | `GET /ws` | Upgrade succeeds when backend is healthy and not draining |

### 3.2 Responsibility boundary

1. Cloud DNS:
- Authoritative public DNS for REST/WS hosts.
2. Certificate Manager + GCLB:
- Public TLS termination for REST/WS.
- Pass WS upgrade traffic without protocol downgrade.
3. Cloud Armor:
- WAF and request-filtering policy at the GCP edge.
4. GCLB:
- L7 backend health judgment.
- New connection distribution only to healthy and ready backends.
5. GKE Ingress:
- Host/path routing to API service.
- Remove draining pods from new request distribution via readiness gate.
6. API:
- `GET /health` returns health response for LB decision.
- `GET /ws` handles connection lifecycle, heartbeat, and close semantics.

## 4. Health check contract

Fixed baseline:

- Endpoint: `GET /health`
- Success criterion: HTTP `200` with expected body (`OK` in current v0 app baseline)
- Failure criterion: timeout, non-2xx, or transport error
- Readiness gating:
1. Backend is routable only while readiness is healthy.
2. Drain starts by switching readiness to unhealthy before pod termination.

Operational checks before rollout:

1. Confirm Cloud DNS host resolves to the active GCLB frontend.
2. Confirm Certificate Manager certificate is active and attached to the intended target proxy.
3. Confirm Cloud Armor policy is attached to the intended edge path.
4. Confirm GCLB health check targets Ingress/API `GET /health`.
5. Confirm Ingress routes both REST and WS host/path to the same API service boundary.

## 5. WS connection lifecycle baseline

### 5.1 Heartbeat and liveness

- WS clients must send heartbeat frames at fixed intervals.
- Server liveness timeout must close stale sessions and release resources.
- Recommended v0 baseline:
1. Heartbeat interval: `30s`
2. Liveness timeout (no heartbeat): `90s`

### 5.2 Reconnect guidance

- Clients must retry WS reconnect with bounded exponential backoff and jitter.
- Recommended v0 baseline:
1. Base delay: `1s`
2. Max delay: `30s`
3. Add random jitter per attempt to avoid reconnect stampede.

### 5.3 Close code baseline

- Rolling drain forced closure: WS close code `1001` (going away).
- AuthZ deny/unavailable behavior remains governed by ADR-004 (`1008` / `1011`) and is not redefined here.

## 6. Rolling update WS drain policy

Goal: minimize abrupt WS disconnects while guaranteeing pod replacement progress.

### 6.1 Drain sequence

1. Enter drain:
- Mark target pod as not-ready to stop new REST/WS assignments.
2. Grace phase:
- Keep existing WS sessions alive during `WS_DRAIN_GRACE_SECONDS` (default `120s`).
3. Forced close phase:
- Close remaining sessions with code `1001`.
- Include reconnect hint in close reason where available.
4. Pod termination:
- Terminate only when open WS count reaches `0` or grace timeout is reached.

### 6.2 Mandatory safeguards

1. Do not route new connections to draining pods.
2. Do not skip forced-close phase when grace timeout is exceeded.
3. Keep rolling-update max unavailable low enough to preserve capacity for reconnect bursts.

## 7. 10,000 concurrent connection validation

This section defines review-ready validation criteria, not load-test script implementation.

### 7.1 Preconditions

1. Staging environment placeholders are filled.
2. WS endpoint is reachable from load generator.
3. Metrics dashboards/log queries for disconnects, reconnects, and memory are prepared.

### 7.2 Procedure

1. Establish 10,000 concurrent WS sessions to staging `wss://<stg_ws_host>/ws`.
2. Hold stable traffic for at least 10 minutes.
3. Execute one rolling update on the WS-serving deployment.
4. Observe reconnect and resource metrics for at least 15 minutes after rollout.

### 7.3 Pass/fail thresholds

| metric | threshold | failure condition |
| --- | --- | --- |
| Disconnect ratio during rollout | `<= 2.0%` | exceeds threshold |
| Reconnect success within 60s | `>= 99.0%` | below threshold |
| P95 reconnect latency | `<= 10s` | exceeds threshold |
| API pod memory peak | `<= 80%` of memory limit | exceeds threshold |
| Edge 5xx ratio during rollout window | `<= 0.5%` | exceeds threshold |

If any threshold fails, treat rollout policy as non-compliant and open follow-up remediation before production rollout.

## 8. Failure scenarios and fallback/rollback

### 8.1 Scenario A: GCLB health check failures

- Detection: sudden healthy-backend drop, health check fail alerts.
- Temporary mitigation:
1. Freeze rollout immediately.
2. Verify `GET /health` reachability from LB path.
3. Restore last known healthy backend config.
- Rollback decision: if healthy backend count cannot recover within 10 minutes, execute route rollback to previous release target.

### 8.2 Scenario B: GKE Ingress routing degradation

- Detection: elevated 5xx, WS upgrade failure spike, Ingress controller errors.
- Temporary mitigation:
1. Pause rollout.
2. Reconcile Ingress resource and controller status.
3. Route traffic only to stable backend revision.
- Rollback decision: if WS upgrade success does not recover to baseline within 15 minutes, rollback deployment and Ingress changes together.

### 8.3 Scenario C: GCP edge config mismatch

- Detection: edge-level certificate, DNS, or policy errors while GCLB and Ingress appear healthy.
- Temporary mitigation:
1. Verify Cloud DNS record, target proxy certificate attachment, and Cloud Armor policy against the active GCLB endpoint.
2. Reapply the last validated GCP edge configuration.
- Rollback decision: if mismatch persists, revert the last validated GCLB / certificate / DNS change set and stop further rollout.

## 9. Rollout procedure (routing-related changes)

1. Pre-check:
- Fill environment placeholders.
- Validate health checks, WS upgrade path, and alert channels.
2. Change execution:
- Apply routing/drain-related change in staging first.
- Run section 7 validation steps.
3. Promotion gate:
- Promote to production only if staging thresholds pass.
4. Production execution:
- Roll out gradually while monitoring thresholds from section 7.
5. Close:
- Record start/end time, thresholds, and incidents.
- If fallback or rollback occurred, attach timeline and root cause summary.

## 10. Acceptance checklist (LIN-585 mapping)

1. Functional:
- REST/WS route and health/drain policy are documented.
2. Performance:
- 10,000 concurrent validation steps and thresholds are documented.
3. Outage handling:
- LB/Ingress failure behavior and fallback/rollback are documented.
4. Operations:
- Routing-change rollout and rollback procedure are documented.

## 11. Dependency boundary with downstream issues

- LIN-586 (Auth): consumes this runbook for REST/WS edge path assumptions.
- LIN-587 (Session): consumes heartbeat/reconnect/drain continuity baseline.
- LIN-591 (Realtime): consumes WS route/drain contract for realtime subject model validation.
- LIN-596 (Observability): consumes thresholds and metrics expectations as minimum telemetry scope.
