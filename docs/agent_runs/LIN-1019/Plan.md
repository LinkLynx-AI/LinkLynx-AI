# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: validation が落ちたら次へ進む前に直す。

## Milestones
### M1: Cloud Armor attach と最小 WAF baseline を Terraform 化する
- Acceptance criteria:
  - [x] `Rust API smoke` Service に `GCPBackendPolicy` で Cloud Armor が attach される
  - [x] baseline WAF rule が追加される
  - [x] prod root で opt-in できる
- Validation:
  - `terraform fmt -check -recursive infra`
  - `PATH=/tmp/terraform_1.6.6:$PATH make infra-validate`

### M2: docs / runbook を low-budget security path に合わせる
- Acceptance criteria:
  - [x] verify / rollback runbook がある
  - [x] `Trivy` scan と audit log baseline への接続が docs にある
  - [x] validation log が残る
- Validation:
  - `make validate`
  - `git diff --check`
