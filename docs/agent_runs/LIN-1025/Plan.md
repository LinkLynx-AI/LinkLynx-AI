# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: validation が落ちたら次へ進む前に直す。

## Milestones
### M1: search secret placeholder module と prod wiring を追加する
- Acceptance criteria:
  - [x] Elastic Cloud 用 secret placeholder module が追加される
  - [x] `prod` root で opt-in できる
  - [x] secret inventory が output / docs から参照できる
- Validation:
  - `terraform fmt -check -recursive infra`
  - `PATH=/tmp/terraform_1.6.6:$PATH make infra-validate`

### M2: low-budget verify / rotation / rollback docs を追加する
- Acceptance criteria:
  - [x] low-budget runbook が追加される
  - [x] README / decisions が standard path との差分を説明する
  - [x] `LIN-975` との責務境界が明確である
- Validation:
  - `make validate`
  - `git diff --check`
