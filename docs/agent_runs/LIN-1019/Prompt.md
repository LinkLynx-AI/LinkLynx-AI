# Prompt.md

## User request
- 次のインフラ issue を順番に実装する
- 現在の low-budget `prod-only` path を維持する

## Target issue
- `LIN-1019` `[13a] prod-only path の Cloud Armor / CI scan / audit log security baseline を整備する`

## Constraints
- `1 issue = 1 PR`
- 既存の `Trivy` scan と Secret Manager audit log baseline を再利用する
- DAST / VPC-SC / bot management までは広げない
