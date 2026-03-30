# Prompt.md

- Issue: `LIN-1030`
- Title: `[13a] prod-only path の CI security scan baseline を整備する`
- Goal: low-budget `prod-only` path における repo secret / infra misconfig の CI baseline を整備する
- Constraints:
  - `1 issue = 1 PR`
  - 既存 image scan (`LIN-966`) と runtime security baseline (`LIN-1019`) を崩さない
  - false positive を増やしすぎない narrow baseline に留める
