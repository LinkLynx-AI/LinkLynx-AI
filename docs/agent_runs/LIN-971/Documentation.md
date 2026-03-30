# Documentation.md (Status / audit log)

## Current status
- Now: implementation completed
- Next: commit / push / PR / Linear 更新

## Decisions
- standard path の managed messaging baseline は provider provisioning ではなく secret/access/smoke contract の codification に寄せる
- Redpanda secret inventory は `bootstrap_servers` / `sasl_username` / `sasl_password` / `ca_bundle` に固定する
- NATS secret inventory は `url` / `creds` / `ca_bundle` に固定する
- default runtime accessor は `api` workload のみとする

## How to run / demo
- `terraform fmt -check -recursive infra`
- `PATH=/tmp/terraform_1.6.6:$PATH make infra-validate`
- `make validate`

## Known issues / follow-ups
- provider-side account / cluster / allowlist / private connectivity 作成は Terraform scope 外
- runtime publish / subscribe 実装と実環境 smoke は後続 runtime rollout issue に残る

## Validation log
- `terraform fmt -check -recursive infra`: pass
- `PATH=/tmp/terraform_1.6.6:$PATH make infra-validate`: pass
- `make validate`: pass
- `git diff --check`: pass
- review: `reviewer_simple` pass（prod low-budget / standard messaging baseline の exclusivity guard を追加して再確認）
- UI review: skipped（infra / docs only）
- runtime smoke: skipped（provider provisioning と runtime client rollout は scope 外）
