# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: if validation fails, repair it before moving to the next step.

## Milestones
### M1: Terraform module に narrow NetworkPolicy baseline を追加する
- Acceptance criteria:
  - [ ] `rust_api_smoke_deploy` に ingress default deny / 8080 allow が入る
  - [ ] `dragonfly_minimal` に ingress default deny / namespace allow が入る
- Validation:
  - `terraform fmt -check -recursive infra`
  - `PATH=/tmp/terraform_1.6.6:$PATH make infra-validate`

### M2: docs と runbook を更新する
- Acceptance criteria:
  - [ ] runbook / README / decision doc が更新される
  - [ ] `docs/agent_runs/LIN-1031/` の memory files を埋める
- Validation:
  - `make validate`
  - `git diff --check`

### M3: review gate と PR evidence を揃える
- Acceptance criteria:
  - [ ] reviewer gate を実施する
  - [ ] PR と Linear 更新に必要な evidence を記録する
- Validation:
  - reviewer gate pass
