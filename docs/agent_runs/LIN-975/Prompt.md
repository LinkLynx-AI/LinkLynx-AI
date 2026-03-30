# Prompt.md (Spec / Source of truth)

## Goals
- `LIN-975` として standard path の検索基盤 hosting 方針を実装前提で収束させる。
- `Elastic Cloud` を採用前提に、`staging` / `prod` で使う接続基盤と Secret Manager / Workload Identity baseline を Terraform で整備する。
- snapshot / restore / vendor boundary / minimum observability seed を runbook と environment docs に固定する。

## Non-goals
- 検索 index 設計や relevance tuning の実装
- application runtime の full search client 実装
- Elastic Cloud deployment 自体の Terraform 管理
- self-managed OpenSearch の provisioning

## Deliverables
- `infra/modules/search_elastic_cloud_standard_baseline`
- `staging` / `prod` 環境への standard search wiring
- standard path search runbook
- observability / infra / environment docs 更新

## Done when
- [x] hosting 方針が `Elastic Cloud` で明示されている
- [x] `staging` / `prod` の standard path から opt-in で接続基盤を有効化できる
- [x] runtime workload 向け secret accessor IAM が付与される
- [x] snapshot / restore / incident triage / vendor boundary が文書化される
- [x] `terraform fmt -check -recursive infra` が通る
- [x] `PATH=/tmp/terraform_1.6.6:$PATH make infra-validate` が通る
- [x] `make validate` が通る

## Constraints
- Perf: search 自体は derived read model なので、write path を待たない ADR-003 の前提を崩さない
- Security: secret value は Git に入れず、Workload Identity + Secret Manager access に限定する
- Compatibility: low-budget path の secret placeholder / lifecycle baseline とは責務を分離し、standard path の接続基盤だけを追加する
