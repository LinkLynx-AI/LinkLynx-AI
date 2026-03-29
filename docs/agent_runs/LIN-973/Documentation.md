# Documentation.md (Status / audit log)

## Current status
- Now:
  - implementation completed
  - validation completed
- Next:
  - commit / push / PR / Linear update

## Decisions
- standard path の edge security baseline は `Cloud Armor policy` 自体を再作成せず、GitOps workload へ `GCPBackendPolicy` で attach する
- application SAST は current repo の既存 finding noise を避けるため changed-files only で始める
- DAST は always-on merge gate にせず、manual workflow baseline と runbook に落とす
- IAM / Secret Manager の read audit は Terraform resource と runbook の両方で baseline 化する
- image vulnerability scan は changed service images の PR gate と pushed digest gate の 2 段で維持する

## Known issues / follow-ups
- standard path cluster access hardening (`master_authorized_networks` / private control plane) は Terraform / Helm access model と結びついており、この issue では boundary の明文化に留める

## Validation log
- `terraform fmt -check -recursive infra`: pass
- `PATH=/tmp/terraform_1.6.6:$PATH make infra-validate`: pass
- `make infra-gitops-validate`: pass
- `make validate`: pass
- `git diff --check`: pass
- note: existing TypeScript tests emit `act(...)` warnings in stderr, but the suite passes without new failures
