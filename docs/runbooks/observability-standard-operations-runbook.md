# Observability Standard Operations Runbook

- Status: Draft
- Last updated: 2026-03-29
- Owner scope: standard path `staging` / `prod` observability baseline
- References:
  - [Observability v0 Structured Logs and Metrics Runbook](./observability-v0-structured-logs-metrics-runbook.md)
  - [GKE Autopilot Standard Operations Runbook](./gke-autopilot-standard-operations-runbook.md)
  - [Cloud SQL PostgreSQL Standard Operations Runbook](./cloud-sql-postgres-standard-operations-runbook.md)
  - [Dragonfly Standard Operations Runbook](./dragonfly-standard-operations-runbook.md)
  - [Scylla Cloud Standard Operations Runbook](./scylla-cloud-standard-operations-runbook.md)
  - [Managed Messaging Cloud Standard Operations Runbook](./managed-messaging-cloud-standard-operations-runbook.md)
  - `LIN-972`

## 1. Purpose and scope

This runbook defines the standard path observability baseline for LinkLynx infrastructure.

In scope:

- in-cluster metrics stack (`Prometheus + Grafana + Alertmanager`)
- in-cluster logs path (`Loki + Grafana Alloy`)
- dependency reachability probes for API / Cloud SQL / Dragonfly / Scylla / Redpanda / NATS
- Discord initial alert route
- API / WebSocket SLO dashboard baseline
- verify / rollback flow and future expansion boundary

Out of scope:

- full application metric instrumentation beyond the v0 contract
- provider-native deep metrics ingestion for Scylla / Redpanda / Synadia / search
- full distributed tracing pipeline
- on-call SaaS routing

## 2. Adopted stack

The standard path baseline is:

- metrics: `kube-prometheus-stack`
- dashboards: `Grafana`
- alert routing: `Alertmanager -> Discord webhook`
- logs: `Loki single-binary + Grafana Alloy`
- dependency probes: `prometheus-blackbox-exporter`
- tracing: deferred; `Tempo` remains a follow-up

This keeps the primary stack portable while still covering managed dependencies with minimum reachability checks.

## 3. Storage and retention baseline

Baseline defaults:

| Component | Baseline |
| --- | --- |
| Prometheus PVC | `50Gi` |
| Prometheus retention | `15d` |
| Alertmanager PVC | `10Gi` |
| Grafana PVC | `10Gi` |
| Loki PVC | `20Gi` |
| Loki retention | `168h` |

Initial posture:

- this is an operator-facing baseline, not a long-term archive tier
- if metrics or logs need longer retention, open a follow-up for object storage / long-term remote write
- Loki runs as single-binary because this issue targets baseline readiness, not a large log cluster

## 4. Monitoring coverage baseline

### 4.1 Cluster / deploy

`kube-prometheus-stack` default rules cover:

- Kubernetes node / pod health
- kube-state-metrics
- Prometheus / Alertmanager self-monitoring
- rollout-adjacent deployment failures at the cluster level

### 4.2 API / WebSocket

Grafana ships a baseline dashboard for:

- API request rate
- API error rate
- API latency `P95 / P99`
- WebSocket active connections
- WebSocket disconnect trend

These panels depend on the contract metrics from
`docs/runbooks/observability-v0-structured-logs-metrics-runbook.md`.

If the application has not emitted those metrics yet, the dashboard is still considered ready as a contract anchor.

### 4.3 Dependency baseline

Blackbox reachability probes cover:

- API health URL
- Cloud SQL private IP on `5432`
- Dragonfly internal service on `6379`
- Scylla contact points
- Redpanda bootstrap targets
- NATS targets

This issue intentionally uses reachability probes as the minimum standard baseline.
Provider-native deep metrics ingestion remains a follow-up.

## 5. Alert routing baseline

Alert flow:

1. Prometheus evaluates built-in and LinkLynx custom rules.
2. Alertmanager groups alerts by `alertname`, `dependency`, and `namespace`.
3. Alertmanager sends initial notifications to Discord through a webhook.

Baseline route notes:

- `Watchdog` stays muted
- alert repeat interval starts at `4h`
- mention text is configurable through Terraform input
- the webhook must not be committed to Git; pass it from local secrets or CI secrets

## 6. Log collection baseline

Grafana Alloy runs as a `DaemonSet` and collects pod logs through the Kubernetes API.

Baseline labels:

- `cluster`
- `environment`
- `namespace`
- `pod`
- `container`
- `app`
- `job`
- `container_runtime`

This path avoids privileged host mounts in the baseline issue.

## 7. Verify flow

### 7.1 Terraform verify

1. `terraform plan` shows the observability module only after standard GKE / GitOps / Cloud SQL / Dragonfly / Scylla / messaging baselines are enabled.
2. the Discord webhook input is non-empty
3. API / Redpanda / NATS probe targets are non-empty

### 7.2 Runtime verify

After apply:

1. port-forward Grafana and confirm both dashboards are visible
2. confirm Prometheus targets include:
   - blackbox exporter
   - Alloy
   - Loki monitoring endpoints
3. confirm `probe_success` exists for:
   - `api`
   - `cloudsql`
   - `dragonfly`
   - `scylla`
   - `redpanda`
   - `nats`
4. fire a test alert and confirm Discord delivery
5. confirm Loki receives pod logs from at least one namespace

## 8. Rollback flow

Rollback order:

1. mute or disable the Discord route if notifications are noisy or malformed
2. disable custom LinkLynx Prometheus rules if they produce false positives
3. disable blackbox targets if provider endpoints are not ready yet
4. if needed, disable the entire `enable_standard_observability_baseline` flag and apply

Do not delete dashboards or probe targets before capturing incident evidence.

## 9. Future expansion boundary

Open follow-up issues when one of the following becomes true:

- provider-native metrics for Scylla / Redpanda / Synadia / search are required
- trace sampling and Tempo ingestion become necessary
- Loki single-binary storage pressure becomes visible
- Discord is no longer sufficient as the primary alert receiver

Keep these contracts stable while expanding:

- the v0 metric names
- the Discord route as the initial human notification path
- dependency reachability coverage for the six baseline target groups
