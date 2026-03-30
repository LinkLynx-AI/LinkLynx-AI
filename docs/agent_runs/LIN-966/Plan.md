# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: if validation fails, repair it before moving to the next step.

## Milestones
### M1: Registry と GitHub OIDC 基盤を Terraform で追加する
- Acceptance criteria:
  - [ ] staging / prod runtime project に Docker repository baseline がある
  - [ ] bootstrap project に GitHub OIDC 用 workload identity pool / provider がある
  - [ ] GitHub Actions 用 publisher service account と必要 IAM が定義されている
- Validation:
  - `terraform fmt -check -recursive infra`
  - `PATH=/tmp/terraform_1.6.6:$PATH make infra-validate`

### M2: GitHub Actions publish workflow と docs を追加する
- Acceptance criteria:
  - [ ] image naming / tag policy が workflow に反映されている
  - [ ] build failure と高重大度脆弱性を workflow で検知できる
  - [ ] promotion flow と required GitHub settings が docs に残っている
- Validation:
  - `make validate`
