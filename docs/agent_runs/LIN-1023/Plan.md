# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: validation が落ちたら次へ進む前に直す。

## Milestones
### M1: Rust image と smoke deploy module に Scylla runtime baseline を追加する
- Acceptance criteria:
  - [x] Rust image に Scylla schema artifact が同梱される
  - [x] `rust_api_smoke_deploy` から `SCYLLA_*` env を inject できる
  - [x] `prod` root で opt-in できる
- Validation:
  - `terraform fmt -check -recursive infra`
  - `make infra-validate`

### M2: low-budget verify / rollback docs を追加する
- Acceptance criteria:
  - [x] low-budget runbook が追加される
  - [x] README / decisions が standard path との差分を説明する
  - [x] `LIN-970` との責務境界が明確である
- Validation:
  - `make validate`
  - `git diff --check`
