# Prompt.md (Spec / Source of truth)

## Goals
- `LIN-965` として、standard path の Workload Identity + Secret Manager baseline を Terraform 化する
- `frontend` / `api` / `ai` の workload-scoped KSA / GSA / secret placeholder を定義する
- staging で verify できる標準手順を docs に残す

## Non-goals
- 各アプリ固有 secret の実値管理
- External Secrets Operator 導入
- app-side secret retrieval 実装

## Deliverables
- `workload_identity_secret_manager_baseline` module の standard path 拡張
- `staging` / `prod` root の standard workload identity wiring
- standard path runbook / README / decision doc 更新

## Done when
- [ ] workload 単位の権限分離が Terraform で表現される
- [ ] Secret Manager から staging workload へ secret を安全に供給する baseline が定義される
- [ ] repo / CI に長期静的キーを置かない方針が docs に反映される
- [ ] rotation / audit の運用手順が記載される

## Constraints
- Perf: `make validate`, `terraform fmt -check -recursive infra`, `make infra-validate` を通す
- Security: secret access は secret-level IAM に限定する
- Compatibility: low-budget path の既存 Rust API smoke wiring を壊さない
