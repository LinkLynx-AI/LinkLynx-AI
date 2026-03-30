# Implement.md

## Implementation outline
1. `ADR-002`, `LIN-601` contract, existing NATS / Redpanda runbook を読み、運用責務の共通前提を固定する。
2. low-budget 向け managed messaging cloud ops runbook を追加する。
3. 既存の secret baseline runbook から新 runbook を参照し、役割を分離する。
4. `docs/infra/01_decisions.md`, `infra/README.md`, `infra/environments/prod/README.md`, `docs/runbooks/README.md` を同期する。
5. `make validate` と `git diff --check` を実行する。
