# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: if validation fails, repair it before moving to the next step.

## Milestones
### M1: standard workload identity baseline を Terraform に追加する
- Acceptance criteria:
  - [ ] module が standard path の KSA 作成まで扱える
  - [ ] `staging` / `prod` root から `frontend` / `api` / `ai` の baseline を呼べる
- Validation:
  - `terraform fmt -check -recursive infra`
  - `PATH=/tmp/terraform_1.6.6:$PATH make infra-validate`

### M2: runbook / README / decisions / memory を更新する
- Acceptance criteria:
  - [ ] standard path runbook が追加される
  - [ ] env README と infra README が同期される
  - [ ] memory files が埋まる
- Validation:
  - `make validate`
  - `git diff --check`

### M3: self-review と PR evidence を揃える
- Acceptance criteria:
  - [ ] validation と skip rationale を Documentation.md に記録する
  - [ ] PR / Linear 更新まで完了する
- Validation:
  - self-review pass
