# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: if validation fails, repair it before moving to the next step.
- Scope は standard path の運用 baseline に限定し、インフラ resource 追加は行わない。

## Milestones
### M1: Docs / dependency review
- Acceptance criteria:
  - [x] `LIN-968`〜`LIN-975` の standard-path runbook / decisions を確認する
  - [x] capacity assumptions と trigger の前提を整理する
- Validation:
  - manual review

### M2: Runbook / template 追加
- Acceptance criteria:
  - [x] standard incident operations runbook を追加する
  - [x] standard postmortem template を追加する
  - [x] capacity trigger / Chaos readiness / tabletop flow を含める
- Validation:
  - `git diff --check`

### M3: Docs 同期 / final validation
- Acceptance criteria:
  - [x] `docs/runbooks/README.md`, `docs/infra/01_decisions.md`, `infra/README.md`, environment README を更新する
  - [x] agent memory を更新する
- Validation:
  - `make validate`
