# Prompt.md

## User request
- 続きのインフラ issue を順番に実装する
- low-budget `prod-only` path を維持する

## Target issue
- `LIN-1021` `[07a] prod-only path の Terraform deploy workflow と manual approval baseline を整備する`

## Constraints
- `1 issue = 1 PR`
- `Argo CD / Argo Rollouts` はまだ導入しない
- 既存の Terraform module 群と GitHub OIDC baseline を再利用する
