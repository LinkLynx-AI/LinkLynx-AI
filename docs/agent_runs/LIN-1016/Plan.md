# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: validation が落ちたら次へ進む前に直す。

## Milestones
### M1: prod-only workload identity / secret access baseline を Terraform 化する
- Acceptance criteria:
  - [x] GSA / KSA binding module がある
  - [x] secret placeholder と secret-level accessor IAM がある
  - [x] Rust API smoke workload の KSA annotation に接続される
- Validation:
  - `terraform fmt -check -recursive infra`
  - `PATH=/tmp/terraform_1.6.6:$PATH make infra-validate`

### M2: runbook と infra docs を更新する
- Acceptance criteria:
  - [x] apply / verify / rotate / rollback 手順が残る
  - [x] low-budget path の前提と `LIN-965` との差分が説明される
  - [x] `make validate` と validation log が残る
- Validation:
  - `make validate`
  - `git diff --check`
