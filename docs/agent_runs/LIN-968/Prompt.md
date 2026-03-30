# Prompt.md

## User request
- `LIN-968` を実装する
- standard path 向けに Cloud SQL baseline と migration / PITR 運用を整備する

## Constraints
- 1 issue = 1 PR
- low-budget `LIN-1017` baseline とは分離する
- `staging` / `prod` の standard path に限定する

## Success target
- standard path 用 Cloud SQL module が追加されている
- staging / prod root に opt-in wiring と outputs が追加されている
- migration / approval / PITR の standard path runbook が追加されている
