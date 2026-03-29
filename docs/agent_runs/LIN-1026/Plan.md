# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: validation が落ちたら次へ進む前に直す。

## Milestones
### M1: Elastic Cloud low-budget ops runbook を追加する
- Acceptance criteria:
  - [x] snapshot / restore / lifecycle / incident triage baseline が runbook に記載される
  - [x] vendor responsibility と LinkLynx responsibility が区別される
  - [x] observability seed が明記される
- Validation:
  - `make validate`

### M2: decisions / README / handoff を更新する
- Acceptance criteria:
  - [x] low-budget path の運用境界が docs に反映される
  - [x] `LIN-975` との責務分界が明確である
- Validation:
  - `git diff --check`
