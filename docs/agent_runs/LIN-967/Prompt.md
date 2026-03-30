# Prompt.md

## User request
- `LIN-967` を実装する
- 標準 path 向けに Argo CD / Argo Rollouts の GitOps baseline を整備する

## Constraints
- 1 issue = 1 PR
- standard path (`staging` / `prod`) に限定する
- low-budget path の Terraform deploy workflow と混ぜない

## Success target
- Argo CD / Argo Rollouts controller install baseline が Terraform に入っている
- repo 内に AppProject / Application / rollout sample の GitOps manifest layout がある
- staging auto sync / prod manual sync の promotion boundary が明文化されている
