# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: validation fails are fixed before moving on.

## Milestones
### M1: Scope と foundation resource 設計を固める
- Acceptance criteria:
  - [ ] `network_foundation` module の責務を定義する。
  - [ ] DNS / TLS / LB foundation を「後続 issue が attach する前提」で切り出す。
  - [ ] required variables と outputs を決める。
- Validation:
  - relevant docs review
  - official GCP / Terraform docs check

### M2: Terraform module と environment wiring を実装する
- Acceptance criteria:
  - [ ] VPC / subnet / PSA / proxy-only / PSC / DNS / cert / Cloud Armor / reserved IP をコード化する。
  - [ ] `staging` / `prod` root から module を利用できる。
  - [ ] README と tfvars example が更新される。
- Validation:
  - `terraform fmt -check -recursive infra`
  - `make infra-validate`

### M3: Repository validation と PR 準備を完了する
- Acceptance criteria:
  - [ ] repo validation を通す。
  - [ ] review gate を通す。
  - [ ] PR 本文に acceptance criteria / tests / pending assumptions を整理する。
- Validation:
  - `make validate`
  - review gate evidence
