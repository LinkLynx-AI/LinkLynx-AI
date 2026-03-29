# Documentation.md (Status / audit log)

## Current status
- Now: implementation completed
- Next: commit / push / PR / Linear 更新

## Decisions
- standard path の ScyllaDB Cloud baseline は cluster provision ではなく connection contract の codification に寄せる
- required secret inventory は `username` / `password` / `ca_bundle` の 3 種に固定する
- default runtime accessor は `api` workload のみとする

## How to run / demo
- `terraform fmt -check -recursive infra`
- `PATH=/tmp/terraform_1.6.6:$PATH make infra-validate`
- `make validate`

## Validation log
- `terraform fmt -check -recursive infra`: pass
- `PATH=/tmp/terraform_1.6.6:$PATH make infra-validate`: pass
- `make validate`: pass
- `git diff --check`: pass
- review: self-review pass
- runtime smoke: skipped（Terraform / runbook / Secret Manager baseline のみで、runtime secret retrieval rollout と GCP 実環境 smoke は後続 issue に残す）

## Known issues / follow-ups
- ScyllaDB Cloud provider-side account / cluster / allowlist 作成は Terraform scope 外
- app-side secret retrieval smoke は後続 runtime rollout issue に残る
