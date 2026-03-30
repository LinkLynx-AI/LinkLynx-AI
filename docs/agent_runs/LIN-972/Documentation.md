# Documentation.md (Status / audit log)

## Current status
- Now:
  - standard observability baseline module is implemented
  - `staging` / `prod` wiring is in place
  - runbook / infra docs / environment docs are updated
  - validation is green
- Next:
  - stage, commit, push, PR 作成
  - Linear を `In Review` に更新

## Decisions
- Standard path の observability stack は `Prometheus + Grafana + Alertmanager + Loki + Alloy + blackbox exporter` を採用した。
- managed dependencies の baseline coverage は deep metrics ではなく reachability probes に留めた。
- Discord を initial alert route とし、Webhook URL は Terraform input で注入する形にした。
- Loki は baseline scope に合わせて single-binary とし、長期 retention や object storage は follow-up に送った。
- Alloy は privileged host mount を避け、Kubernetes API 経由の pod log collection baseline を採用した。

## How to run / demo
- Terraform side:
  - `terraform fmt -check -recursive infra`
  - `PATH=/tmp/terraform_1.6.6:$PATH make infra-validate`
- Repo validation:
  - `make validate`
- Runtime demo after apply:
  - enable `enable_standard_observability_baseline = true`
  - set `standard_observability_discord_webhook_url`
  - set API / Redpanda / NATS probe targets
  - apply staging first
  - port-forward Grafana using the module output command and verify the two dashboards

## Known issues / follow-ups
- `make validate` first run hit an unrelated flaky timeout in `typescript/src/features/context-menus/ui/server-context-menu.test.tsx`; targeted rerun passed, and the subsequent full rerun also passed.
- provider-native metrics ingestion for Scylla / Redpanda / Synadia / search remains a follow-up.
- Tempo / distributed tracing remains out of scope for this issue.
