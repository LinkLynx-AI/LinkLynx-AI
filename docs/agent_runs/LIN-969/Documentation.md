# Documentation.md (Status / audit log)

## Current status
- Now: implementation completed
- Next: PR / Linear 更新

## Decisions
- Autopilot baseline では node-pool isolation ではなく workload isolation を採る
- standard Dragonfly は `data` namespace の StatefulSet で固定する
- allowed client namespaces は `api` から始める

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
- real connectivity smoke には backend / GCP credentials / cluster access が必要
- replication / alert automation は後続 issue に残す
