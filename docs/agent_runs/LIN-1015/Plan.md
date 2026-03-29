# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: if validation fails, repair it before moving to the next step.

## Milestones
### M1: prod root に smoke workload の Terraform wiring を追加する
- Acceptance criteria:
  - [x] Kubernetes provider が prod cluster output を使って構成される
  - [x] Rust API smoke workload module が namespace / service account / deployment / service / edge route を持つ
  - [x] image digest と public host を変数で差し替えられる
- Validation:
  - `terraform fmt -check -recursive infra`
  - `PATH=/tmp/terraform_1.6.6:$PATH make infra-validate`

### M2: docs と example 設定を更新する
- Acceptance criteria:
  - [x] prod apply / rollback / verify 手順が docs にある
  - [x] low-budget path における staging との差分が説明されている
  - [x] local で回せる validation と skip 理由が記録されている
- Validation:
  - `make validate`
  - `PATH=/tmp/terraform_1.6.6:$PATH terraform -chdir=infra/environments/prod init -backend=false -reconfigure >/dev/null && PATH=/tmp/terraform_1.6.6:$PATH terraform -chdir=infra/environments/prod plan -refresh=false -var-file=terraform.tfvars.example`
