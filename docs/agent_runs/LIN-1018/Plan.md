# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: validation が落ちたら次へ進む前に直す。

## Milestones
### M1: low-budget observability module を Terraform 化する
- Acceptance criteria:
  - [x] Cloud Monitoring dashboard がある
  - [x] alert policy baseline がある
  - [x] optional notification channel baseline がある
- Validation:
  - `terraform fmt -check -recursive infra`
  - `PATH=/tmp/terraform_1.6.6:$PATH make infra-validate`

### M2: docs / runbook を prod-only path に合わせる
- Acceptance criteria:
  - [x] low-budget path と標準 path の observability 差分が説明される
  - [x] Cloud Monitoring baseline の運用 runbook がある
  - [x] `make validate` と validation log が残る
- Validation:
  - `make validate`
  - `git diff --check`
