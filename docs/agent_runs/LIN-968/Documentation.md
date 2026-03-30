# Documentation.md (Status / audit log)

## Current status
- Now: implementation and validation completed
- Next: PR / Linear 更新、続けて次の child issue へ着手

## Decisions
- standard path の Cloud SQL は `staging=ZONAL / prod=REGIONAL`
- tier は `db-custom-4-16384` を baseline にする
- prod read replica は baseline では作らない

## How to run / demo
- `terraform fmt -check -recursive infra`
- `PATH=/tmp/terraform_1.6.6:$PATH make infra-validate`
- `make validate`

## Validation log
- `terraform fmt -check -recursive infra`: pass
- `PATH=/tmp/terraform_1.6.6:$PATH make infra-validate`: pass
- `make validate`: pass
- `git diff --check`: pass

## Known issues / follow-ups
- real `terraform plan` / apply には backend と GCP credentials が必要
- prod read replica と migration automation runner は follow-up issue に残す
