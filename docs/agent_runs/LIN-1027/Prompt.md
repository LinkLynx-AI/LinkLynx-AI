# Prompt.md

- Issue: `LIN-1027`
- Title: `[11e] prod-only path の Redpanda Cloud / Synadia Cloud ops baseline を整備する`
- Goal: low-budget `prod-only` path における managed messaging の ownership / incident-triage / monitoring seed baseline を docs で固定する
- Constraints:
  - `1 issue = 1 PR`
  - runtime client 実装、provider provisioning、network/auth onboarding は scope 外
  - `LIN-1024` の secret inventory baseline と `LIN-971` の標準 path boundary を崩さない
