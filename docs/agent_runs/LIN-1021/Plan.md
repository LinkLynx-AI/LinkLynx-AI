# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: validation が落ちたら次へ進む前に直す。

## Milestones
### M1: GitHub Terraform deployer identity baseline を bootstrap に追加する
- Acceptance criteria:
  - [x] bootstrap から `prod` 用 Terraform deployer service account が作られる
  - [x] state bucket access と `terraform-admin` impersonation 導線が追加される
  - [x] output と README で参照できる
- Validation:
  - `terraform fmt -check -recursive infra`
  - `make infra-validate`

### M2: low-budget prod deploy workflow と runbook を追加する
- Acceptance criteria:
  - [x] `plan` / `apply` を分けた GitHub Actions workflow がある
  - [x] `apply` に `main` guard と `prod` approval 境界がある
  - [x] deploy / rollback 手順が docs にある
- Validation:
  - `make validate`
  - `git diff --check`
