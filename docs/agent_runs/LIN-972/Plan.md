# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: if validation fails, repair it before moving to the next step.
- Scope は `LIN-972` の observability baseline に限定し、instrumentation 拡張や provider deep metrics は混ぜない。

## Milestones
### M1: Docs / scope review
- Acceptance criteria:
  - [x] `docs/infra/01_decisions.md` と関連 runbook を確認して standard observability の方針を固定する
  - [x] standard path modules への依存関係を確認する
- Validation:
  - manual review

### M2: Terraform module 実装
- Acceptance criteria:
  - [x] `observability_standard_baseline` module を追加する
  - [x] Prometheus / Grafana / Alertmanager / Loki / Alloy / blackbox exporter を baseline として定義する
  - [x] `staging` / `prod` から module を呼び出せる
- Validation:
  - `terraform fmt -check -recursive infra`
  - `PATH=/tmp/terraform_1.6.6:$PATH make infra-validate`

### M3: Runbook / docs / final validation
- Acceptance criteria:
  - [x] observability standard runbook を追加する
  - [x] infra / environment README / decisions を更新する
  - [x] agent memory を更新する
- Validation:
  - `make validate`
  - `git diff --check`
