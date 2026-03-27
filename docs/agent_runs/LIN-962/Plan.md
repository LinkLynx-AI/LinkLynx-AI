# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: if validation fails, repair it before moving to the next step.

## Milestones
### M1: Terraform bootstrap skeleton を追加する
- Acceptance criteria:
  - [x] `infra/` 配下に modules / environments の基本構成がある
  - [x] LIN-962 の memory files が作成されている
- Validation:
  - `git status --short`

### M2: bootstrap / project baseline を Terraform で表現する
- Acceptance criteria:
  - [x] bootstrap project, state bucket, admin service account の定義がある
  - [x] `staging` / `prod` project baseline module がある
  - [x] 後続 env root が使う backend 雛形が生成される
- Validation:
  - `rg -n "google_project|google_storage_bucket|google_service_account|google_billing_budget" infra`

### M3: 運用ドキュメントとローカル検証導線を整える
- Acceptance criteria:
  - [x] naming convention と budget baseline が文書化されている
  - [x] Terraform 用のローカル実行導線がある
  - [x] issue 完了時点の制約が Documentation.md に残っている
- Validation:
  - `make validate`
  - `git diff --check`
