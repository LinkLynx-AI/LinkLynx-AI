# Prompt.md (Spec / Source of truth)

## Goals
- `LIN-971` として、standard path 向けの Redpanda Cloud / Synadia Cloud connection baseline を Terraform と runbook で整備する
- `staging` / `prod` で使う managed messaging の secret inventory、accessor IAM、smoke contract を codify する

## Non-goals
- provider account / cluster の provisioning automation
- runtime producer / consumer 実装
- self-managed Redpanda / NATS の再検討

## Deliverables
- `managed_messaging_cloud_standard_baseline` Terraform module
- `staging` / `prod` env wiring と prerequisite check
- standard path runbook と infra docs / README 更新
- `docs/agent_runs/LIN-971/` memory 一式

## Done when
- [ ] `staging` / `prod` の standard path で managed messaging secret/access baseline を opt-in できる
- [ ] Redpanda / NATS の smoke contract と rotation / incident triage が runbook に記載される
- [ ] `make validate` を含む required validation が通る
- [ ] PR と Linear 更新まで完了する

## Constraints
- Perf: messaging provider 自体の性能 tuning は scope 外
- Security: credential material は Secret Manager に限定し、Workload Identity で access する
- Compatibility: ADR-002 / LIN-601 の契約を壊さない
