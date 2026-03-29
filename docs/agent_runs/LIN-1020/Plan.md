# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: validation が落ちたら次へ進む前に直す。

## Milestones
### M1: low-budget incident / capacity baseline を runbook 化する
- Acceptance criteria:
  - [x] incident flow が runbook として書かれている
  - [x] capacity assumptions と scale trigger が明文化されている
  - [x] chaos readiness 条件が固定日ではなく条件ベースで定義されている
- Validation:
  - `make validate`
  - `git diff --check`

### M2: postmortem template と docs 差分を整える
- Acceptance criteria:
  - [x] postmortem template がある
  - [x] low-budget path と標準 path の運用差分が docs に記載される
  - [x] validation log が残る
- Validation:
  - `make validate`
  - `git diff --check`
