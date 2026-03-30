# Implement.md

## Implementation outline
1. `LIN-1018` と各 external dependency runbook を読み、low-budget observability の handoff 境界を固定する。
2. external dependency observability runbook を追加する。
3. `cloud-monitoring-low-budget-operations-runbook.md` から新 runbook を参照し、triage flow を接続する。
4. `docs/infra/01_decisions.md`, `infra/README.md`, `infra/environments/prod/README.md`, `docs/runbooks/README.md` を同期する。
5. `make validate` と `git diff --check` を実行する。
