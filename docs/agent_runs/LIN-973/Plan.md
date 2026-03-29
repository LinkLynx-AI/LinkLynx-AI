# Plan.md (Milestones + validations)

## Rules
- stop-and-fix: validation failure はその場で修正してから次へ進む
- `LIN-973` の security baseline に集中し、feature work や provider 再設計は混ぜない

## Milestones
### M1: Scope / docs review
- Acceptance criteria:
  - [x] issue / ADR / runbook / existing infra を確認して scope を固定する
  - [x] standard path の gap を整理する
- Validation:
  - manual review

### M2: Edge / CI baseline implementation
- Acceptance criteria:
  - [x] standard GitOps canary-smoke に `Cloud Armor` attach manifest を追加する
  - [x] CI に dependency / application scan を追加する
  - [x] manual DAST baseline workflow を追加する
- Validation:
  - `make infra-gitops-validate`
  - manual workflow syntax review

### M3: Audit / docs / final validation
- Acceptance criteria:
  - [x] cluster / IAM / secret audit baseline を docs と Terraform に反映する
  - [x] fail-close / fail-open boundary を runbook に固定する
  - [x] infra docs / environment docs / agent memory を更新する
- Validation:
  - [x] `terraform fmt -check -recursive infra`
  - [x] `PATH=/tmp/terraform_1.6.6:$PATH make infra-validate`
  - [x] `make validate`
  - [x] `git diff --check`
