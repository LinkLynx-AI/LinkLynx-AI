# Implement.md

## Scope lock
- `LIN-1026` は low-budget `prod-only` path の Elastic Cloud snapshot / lifecycle ops baseline に限定する。
- runtime query / indexing implementation や Terraform provisioning は行わない。

## Planned edits
1. Elastic Cloud low-budget ops runbook を追加する。
2. `docs/runbooks/README.md`, `docs/infra/01_decisions.md`, `infra/README.md`, `infra/environments/prod/README.md` を更新する。
3. `LIN-975` との handoff 境界が伝わるように docs を整理する。
