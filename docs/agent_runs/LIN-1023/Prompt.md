# Prompt.md

## User request
- 続きのインフラ issue を順番に実装する
- low-budget `prod-only` path を維持する

## Target issue
- `LIN-1023` `[10a] prod-only path の Scylla runtime 接続 baseline を整備する`

## Constraints
- `1 issue = 1 PR`
- 標準 path の `LIN-970` は閉じない
- cluster / network / backup automation ではなく workload-side runtime baseline に限定する
