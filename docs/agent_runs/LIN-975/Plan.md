# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: if validation fails, repair it before moving to the next step.
- Scope は `LIN-975` の standard search baseline に限定し、runtime search feature 実装は混ぜない。

## Milestones
### M1: Docs / baseline decision review
- Acceptance criteria:
  - [x] `docs/infra/01_decisions.md`、ADR-003、runtime contract、low-budget search runbook を確認する
  - [x] standard path module / env wiring パターンを確認する
  - [x] `Elastic Cloud` を標準 path の hosting choice として採る方針を固定する
- Validation:
  - manual review

### M2: Terraform module と environment wiring
- Acceptance criteria:
  - [x] `search_elastic_cloud_standard_baseline` module を追加する
  - [x] `staging` / `prod` から opt-in で enable できる
  - [x] runtime accessor IAM と observability seed を wiring する
- Validation:
  - `terraform fmt -check -recursive infra`
  - `PATH=/tmp/terraform_1.6.6:$PATH make infra-validate`

### M3: Runbook / docs / final validation
- Acceptance criteria:
  - [x] standard search runbook を追加する
  - [x] infra / environment README / decisions / runbook guide を更新する
  - [x] agent memory を更新する
- Validation:
  - `make validate`
  - `git diff --check`
