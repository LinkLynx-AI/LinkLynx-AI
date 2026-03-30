# Implement.md

## Scope lock
- `LIN-1025` は low-budget `prod-only` path の Elastic Cloud secret baseline に限定する。
- Elastic Cloud deployment / OpenSearch self-managed 比較 / runtime env wiring は実装しない。

## Planned edits
1. Search 用 Secret Manager placeholder module を追加する。
2. `infra/environments/prod` に opt-in variables と prerequisite checks を追加する。
3. low-budget runbook / README / decisions / agent memory を更新する。
