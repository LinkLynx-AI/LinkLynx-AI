# Implement.md (Runbook)

- Follow Plan.md as the single execution order. If order changes are needed, document the reason in Documentation.md and update it.
- Keep diffs small and do not mix in out-of-scope improvements.
- Run validation after each milestone and fix failures immediately before continuing.
- Continuously update Documentation.md with decisions, progress, demo steps, and known issues.

## LIN-972 execution notes

1. Read the existing infra decision docs and runbooks to keep the stack aligned with the documented standard path.
2. Add a dedicated Terraform module for the standard observability baseline instead of mixing resources into environment roots.
3. Keep the stack portable:
   - metrics: `kube-prometheus-stack`
   - logs: `Loki + Grafana Alloy`
   - alerts: `Alertmanager -> Discord`
   - dependency probes: `prometheus-blackbox-exporter`
4. Wire the module into `staging` and `prod` only behind explicit `enable_standard_observability_baseline`.
5. Add prerequisite checks so users cannot enable observability without the standard GKE / GitOps / Cloud SQL / Dragonfly / Scylla / messaging baselines.
6. Verify with Terraform validation first, then repo-wide validation.
