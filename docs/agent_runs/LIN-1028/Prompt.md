# Prompt.md

- Issue: `LIN-1028`
- Title: `[10b] prod-only path の external Scylla ops / backup baseline を整備する`
- Goal: low-budget `prod-only` path における external Scylla の ownership / backup / restore / monitoring seed baseline を docs で固定する
- Constraints:
  - `1 issue = 1 PR`
  - cluster provisioning、auth/TLS/private connectivity の本実装は scope 外
  - `LIN-1023` の runtime wiring baseline と `LIN-970` の標準 path boundary を崩さない
