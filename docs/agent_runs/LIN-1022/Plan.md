# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: validation が落ちたら次へ進む前に直す。

## Milestones
### M1: low-budget Dragonfly module と prod wiring を追加する
- Acceptance criteria:
  - [x] Dragonfly workload module が追加される
  - [x] `prod` root で opt-in できる
  - [x] internal endpoint baseline が output または docs で参照できる
- Validation:
  - `terraform fmt -check -recursive infra`
  - `make infra-validate`

### M2: volatile-only boundary と ops docs を追加する
- Acceptance criteria:
  - [x] low-budget runbook が追加される
  - [x] README / decisions が standard path との差分を説明する
  - [x] ADR-005 / session fallback と矛盾しない
- Validation:
  - `make validate`
  - `git diff --check`
