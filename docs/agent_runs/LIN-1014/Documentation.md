# Documentation.md (Status / audit log)

## Current status
- Now: low-budget prod-only GKE module と docs 実装、validation 完了。
- Next: self-review を通して commit / PR を作成する。

## Decisions
- `LIN-1014` は `prod only` を採用し、staging 常設 cluster は作らない。
- low-budget path では fixed request を baseline にし、VPA は recommendation-only に留める。
- custom node service account を作り、Autopilot cluster の `auto_provisioning_defaults.service_account` に割り当てる。
- initial workload baseline は `CPU 500m / Memory 512Mi / Ephemeral 1Gi` を Rust API 向けの起点とする。

## How to run / demo
- `terraform fmt -check -recursive infra`
- `make infra-validate`
- `make validate`

## Known issues / follow-ups
- この branch は `LIN-963` 上の stacked branch。
- 実運用の `kubectl` / `terraform plan` は backend と GCP credentials が必要。
- `terraform plan` は backend 未初期化の local workspace では未実施。

## Validation log
- Passed: `terraform fmt -check -recursive infra`
- Passed: `make infra-validate` with `PATH=/tmp/terraform_1.6.6:$PATH`
- Passed: `make validate`
- Skipped: real `terraform plan` / `kubectl` checks because backend.hcl と GCP credentials が local workspace にない
