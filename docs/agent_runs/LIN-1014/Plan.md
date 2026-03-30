# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: validation fails are fixed before moving on.

## Milestones
### M1: Low-budget GKE 前提と module 設計を固める
- Acceptance criteria:
  - [ ] prod only / staging no-cluster の責務を明文化する
  - [ ] cluster resource, node service account, outputs を決める
  - [ ] resource request baseline と upgrade 条件を決める
- Validation:
  - relevant docs review
  - official GKE / Terraform docs check

### M2: Terraform と docs を実装する
- Acceptance criteria:
  - [ ] prod root に minimal Autopilot cluster を追加する
  - [ ] staging no-cluster を docs と code で明示する
  - [ ] infra docs に low-budget path を追記する
- Validation:
  - `terraform fmt -check -recursive infra`
  - `make infra-validate`

### M3: Repo validation と PR 準備を完了する
- Acceptance criteria:
  - [ ] `make validate` が通る
  - [ ] review gate を通す
  - [ ] PR に cost assumptions と skipped checks を整理する
- Validation:
  - `make validate`
  - review gate evidence
