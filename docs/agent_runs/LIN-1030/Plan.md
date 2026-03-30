# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: validation が落ちたら次へ進む前に直す。

## Milestones
### M1: CI security scan baseline を追加する
- Acceptance criteria:
  - [x] `Gitleaks` の repo secret scan job が CI にある
  - [x] `Trivy config` の infra misconfig scan job が CI にある
  - [x] fail-fast とローカル再現コマンドが固定される
- Validation:
  - `docker run ... gitleaks ...`
  - `docker run ... trivy config ...`

### M2: low-budget security docs と runbook を更新する
- Acceptance criteria:
  - [x] accepted ignore と rationale が docs に明記される
  - [x] `LIN-1019` と `LIN-973` の境界が docs に反映される
- Validation:
  - `make validate`
  - `git diff --check`
