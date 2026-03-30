# Prompt.md

- Issue: `LIN-970` `[10] ScyllaDB Cloud 接続基盤を整備する`
- Goal: standard path の ScyllaDB Cloud 接続 baseline を Terraform と runbook で固定する
- Scope:
  - staging / prod の contact-point / secret / accessor baseline
  - provider と LinkLynx の責務分界
  - backup / restore / schema ownership の文書化
- Non-goals:
  - ScyllaDB Cloud cluster の Terraform provision
  - self-managed GCE 案の実装
  - アプリ query 設計の変更
