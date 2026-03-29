# Cloud Monitoring Low-Budget Operations Runbook

- Status: Draft
- Last updated: 2026-03-29
- Owner scope: low-budget `prod-only` observability baseline
- References:
  - `docs/runbooks/observability-v0-structured-logs-metrics-runbook.md`
  - `docs/runbooks/cloud-sql-postgres-migration-operations-runbook.md`
  - `docs/runbooks/postgres-pitr-runbook.md`
  - `LIN-1018`

## 1. Purpose and scope

This runbook defines the minimal observability baseline for the low-budget `prod-only` path.

In scope:

- Cloud Monitoring dashboard baseline
- Email or pre-existing notification channel attachment
- Alert policies for Rust API restart bursts and Cloud SQL CPU pressure

Out of scope:

- Discord forwarding automation
- Prometheus / Grafana / Loki self-hosted stack
- Dragonfly / Scylla / messaging observability

## 2. Stack choice

- Metrics and dashboards: `Cloud Monitoring`
- Logs: `Cloud Logging`
- Notification routing: optional Monitoring notification channels

This path intentionally favors lower setup cost over portability. The standard path can still move to self-hosted observability later.

## 3. Baseline checks

After apply, confirm:

1. The dashboard is visible in Cloud Monitoring.
2. The Rust API restart alert policy is enabled.
3. The Cloud SQL CPU alert policy is enabled.
4. Notification channels are attached only when explicitly configured.

## 4. Triage flow

1. Check the dashboard first to decide whether the issue is cluster/workload-side or database-side.
2. For Rust API restart alerts:
   - confirm rollout or image change history
   - inspect pod logs in Cloud Logging
   - inspect recent config / secret / image digest changes
3. For Cloud SQL CPU alerts:
   - confirm query spike or migration activity
   - compare with connection pressure and recent deploys
   - decide whether to scale up, throttle, or enter incident handling

## 5. Notification routing notes

- Low-budget path keeps notification channels optional.
- Discord mention routing remains a follow-up concern; this runbook does not assume a custom forwarder.
- If no notification channel is attached, the dashboard still serves as the baseline visibility source.
