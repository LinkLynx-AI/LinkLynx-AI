# Documentation.md (Status / audit log)

## Current status
- Now: standard Workload Identity / Secret Manager baseline の実装と validation が完了
- Next: PR / Linear 更新、続けて次の child issue へ着手

## Decisions
- standard path は `frontend` / `api` / `ai` を initial workload identity 対象にする
- module は low-budget path を壊さないように optional KSA 管理で拡張する
- standard path でも ESO ではなく direct Secret Manager access を baseline にする
- secret access audit は staging / prod 両方で追えるようにする

## How to run / demo
- `terraform fmt -check -recursive infra`
- `PATH=/tmp/terraform_1.6.6:$PATH make infra-validate`
- `make validate`
- `terraform output standard_runtime_identities`

## Validation log
- `terraform fmt -check -recursive infra`: pass
- `PATH=/tmp/terraform_1.6.6:$PATH make infra-validate`: pass
- `make validate`: pass
- `git diff --check`: pass

## Known issues / follow-ups
- real `terraform plan` / `kubectl` verify には backend と GCP credentials が必要
- 実 secret value の投入と app-side retrieval smoke は後続 issue に残す
