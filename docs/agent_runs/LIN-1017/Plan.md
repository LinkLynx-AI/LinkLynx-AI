# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: validation が落ちたら次へ進む前に直す。

## Milestones
### M1: prod-only Cloud SQL baseline module を Terraform 化する
- Acceptance criteria:
  - [x] Cloud SQL instance / database baseline module がある
  - [x] prod root に low-budget path の toggle と output がある
  - [x] private IP / backup / PITR / maintenance / deletion protection を定義する
- Validation:
  - `terraform fmt -check -recursive infra`
  - `PATH=/tmp/terraform_1.6.6:$PATH make infra-validate`

### M2: docs / runbook を Cloud SQL 前提へ寄せる
- Acceptance criteria:
  - [x] low-budget profile と standard profile の差分が説明される
  - [x] PITR runbook と migration runbook が Cloud SQL 前提で揃う
  - [x] `make validate` と validation log が残る
- Validation:
  - `make validate`
  - `git diff --check`
