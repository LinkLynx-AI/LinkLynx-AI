# Documentation.md (Status / audit log)

## Current status
- Now:
  - `LIN-1013` の implementation / validation / PR / Linear 更新が完了
- Next:
  - human review を待つ

## Decisions
- `staging` smoke deploy は既存の `rust_api_smoke_deploy` module を再利用する。
- 本 issue では Workload Identity / Secret Manager を入れず、cluster + edge + image digest だけで閉じる。
- branch は unmerged stack を崩さないため `codex/lin-974-standard-ops-capacity-baseline-stacked` の上に積む。

## How to run / demo
- `terraform fmt -check -recursive infra`
- `PATH=/tmp/terraform_1.6.6:$PATH make infra-validate`
- `make validate`
- `cd infra/environments/staging && terraform plan`
- `curl -i -sS https://<stg_api_host>/health`
- `wscat -c wss://<stg_api_host>/ws`

## Validation log
- `git diff --check`
- `terraform fmt -check -recursive infra`
- `PATH=/tmp/terraform_1.6.6:$PATH make infra-validate`
- `make validate`
- TypeScript test suite では既存の `act(...)` warning が stderr に出るが、最終結果は pass

## Files changed
- `infra/environments/staging/main.tf`
- `infra/environments/staging/variables.tf`
- `infra/environments/staging/terraform.tfvars.example`
- `infra/environments/staging/README.md`
- `infra/README.md`
- `docs/runbooks/README.md`
- `docs/runbooks/staging-rust-api-smoke-deploy-operations-runbook.md`
- `docs/agent_runs/LIN-1013/Prompt.md`
- `docs/agent_runs/LIN-1013/Plan.md`
- `docs/agent_runs/LIN-1013/Implement.md`
- `docs/agent_runs/LIN-1013/Documentation.md`

## Known issues / follow-ups
- runtime secret access と DB connectivity は後続 issue に残す。
- GitOps 化は `LIN-967` で扱う。
- PR: `#1321`
- Linear: `LIN-1013` は `In Review` に更新済み
