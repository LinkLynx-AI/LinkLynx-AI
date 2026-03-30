# Documentation.md (Status / audit log)

## Current status
- Now: validation 完了。PR / Linear 更新前の self-review 段階
- Next: commit / push / PR / Linear 更新

## Decisions
- standard path は cluster module と namespace baseline module を分離する
- `prod` では low-budget cluster と standard cluster を排他にする
- namespace baseline は `frontend` / `api` / `ai` / `data` / `ops` / `observability`
- restricted ingress baseline は `data` / `ops` / `observability` のみに先行導入する
- VPA は policy/docs を先に固定し、workload object は後続 issue に残す

## How to run / demo
- `terraform fmt -check -recursive infra`
- `PATH=/tmp/terraform_1.6.6:$PATH make infra-validate`
- `make validate`
- `kubectl get ns`
- `kubectl get networkpolicy -A`

## Known issues / follow-ups
- real `terraform plan` / `kubectl` verify には backend と GCP credentials が必要
- private control plane や `master_authorized_networks` はこの issue に含めない
- workload target がまだないため、real VPA object は後続 issue に残す

## Validation log
- Passed: `terraform fmt -check -recursive infra`
- Passed: `PATH=/tmp/terraform_1.6.6:$PATH make infra-validate`
- Passed: `make validate`
- Passed: `git diff --check`
- Skipped: real `terraform plan` / `kubectl` verify because backend.hcl と GCP credentials が local workspace にない
