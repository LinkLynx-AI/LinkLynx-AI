# Documentation.md (Status / audit log)

## Current status
- Now: implementation and validation completed
- Next: PR / Linear 更新、続けて次の child issue へ着手

## Decisions
- Terraform は Argo CD / Argo Rollouts controller install までを担当する
- AppProject / Application は repo 内の bootstrap manifest として保持する
- staging は automated sync、prod は manual sync を baseline にする
- rollout template は `canary-smoke` sample workload で固定する

## How to run / demo
- `terraform fmt -check -recursive infra`
- `PATH=/tmp/terraform_1.6.6:$PATH make infra-validate`
- `make infra-gitops-validate`
- `make validate`

## Validation log
- `terraform fmt -check -recursive infra`: pass
- `PATH=/tmp/terraform_1.6.6:$PATH make infra-validate`: pass
- `make infra-gitops-validate`: pass
- `make validate`: pass
- `git diff --check`: pass

## Known issues / follow-ups
- real `terraform plan` / cluster apply には backend と GCP credentials が必要
- real service image digest promotion と analysis template は後続 issue に残す
