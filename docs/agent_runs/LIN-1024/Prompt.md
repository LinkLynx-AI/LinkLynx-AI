# Prompt.md

## User request
- 続きのインフラ issue を順番に実装する
- low-budget `prod-only` path を維持する

## Target issue
- `LIN-1024` `[11a] prod-only path の managed messaging secret baseline を整備する`

## Constraints
- `1 issue = 1 PR`
- 標準 path の `LIN-971` は閉じない
- runtime client / broker provision ではなく Secret Manager inventory baseline に限定する
