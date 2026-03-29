# Prompt.md

## User request
- 次のインフラ issue を順番に実装する
- 現在の low-budget `prod-only` path を維持する

## Target issue
- `LIN-1017` `[08a] prod-only path の Cloud SQL baseline と PITR / migration runbook を整備する`

## Constraints
- `1 issue = 1 PR`
- Terraform で baseline を再現可能にする
- app 接続実装や Auth Proxy 導入までは広げない
