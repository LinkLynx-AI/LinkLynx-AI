# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: if validation fails, repair it before moving to the next step.

## Milestones
### M1: standard GKE cluster module と namespace baseline module を追加する
- Acceptance criteria:
  - [ ] cluster baseline module が追加される
  - [ ] namespace / RBAC / restricted ingress baseline module が追加される
- Validation:
  - `terraform fmt -check -recursive infra`
  - `PATH=/tmp/terraform_1.6.6:$PATH make infra-validate`

### M2: staging / prod へ wiring し、docs を更新する
- Acceptance criteria:
  - [ ] `staging` / `prod` root から opt-in で呼べる
  - [ ] low-budget との排他条件が `prod` に入る
  - [ ] runbook / README / decisions / memory が更新される
- Validation:
  - `make validate`
  - `git diff --check`

### M3: self-review と PR evidence を揃える
- Acceptance criteria:
  - [ ] evidence を Documentation.md に記録する
  - [ ] PR / Linear 更新まで完了する
- Validation:
  - self-review pass
