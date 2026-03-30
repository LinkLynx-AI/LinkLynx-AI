# Documentation.md (Status / audit log)

## Current status
- Now: `LIN-1021` の実装と validation が完了し、PR 化の最終整理段階
- Next: commit / push / PR 作成と Linear 更新

## Decisions
- low-budget path の deploy baseline は `Argo CD` ではなく GitHub Actions + Terraform apply を採用する
- GitHub Actions は dedicated deployer SA で開始し、runtime 権限は `terraform-admin` impersonation に寄せる

## How to run / demo
- `workflow_dispatch` で `.github/workflows/infra-deploy-prod.yml` を実行する
- `operation=plan` で tfplan を確認する
- `operation=apply` は `main` + `prod` environment approval が必要

## Validation log
- `terraform fmt -recursive infra`
- `PATH=/tmp/terraform_1.6.6:$PATH make infra-validate`
- `make validate`
- `git diff --check`
- manual self-review:
  - no UI changes, so UI review is not applicable
  - no blocking findings were identified in bootstrap IAM, workflow guardrails, or low-budget deploy docs

## Known issues / follow-ups
- 実 GCP credentials / GitHub environment がないローカルでは workflow の end-to-end 実行は未確認
- 標準 path の `LIN-967` は staging + prod / GitOps 導入時に別 issue として再開する
