# Prompt.md

- Issue: `LIN-1029`
- Title: `[12b] prod-only path の external dependency observability baseline を整備する`
- Goal: low-budget `prod-only` path における external dependency observability handoff を docs で固定する
- Constraints:
  - `1 issue = 1 PR`
  - provider metrics ingestion や dashboard automation は scope 外
  - `LIN-1018` の Cloud Monitoring baseline と `LIN-972` の標準 path boundary を崩さない
