# Documentation.md (Status / audit log)

## Current status
- Now:
  - standard path の search baseline 実装が完了している
  - validation が green
- Next:
  - stage / commit / push / PR 作成
  - Linear を `In Review` に更新する

## Decisions
- standard path の検索基盤 hosting は `Elastic Cloud` を採用する。
- `OpenSearch self-managed` は portability fallback として残すが、Phase 1 の初期標準には採らない。
- runtime secret access は `api` workload を default にし、必要なら Terraform input で expand する。
- observability は provider-native deep metrics ingestion ではなく、まず blackbox reachability + provider console / snapshot signals の組み合わせを baseline にする。

## How to run / demo
- Terraform side:
  - `terraform fmt -check -recursive infra`
  - `PATH=/tmp/terraform_1.6.6:$PATH make infra-validate`
- Repo validation:
  - `make validate`
- Runtime / ops demo after apply:
  - `enable_standard_search_baseline = true`
  - `standard_search_probe_targets` を設定する
  - Secret Manager に `api_key` と locator secret (`cloud_id` または `endpoint`) の version を追加する
  - staging で `/_cluster/health` と `messages` index の query / indexing smoke を確認する

## Known issues / follow-ups
- Elastic Cloud deployment provisioning 自体は Terraform scope 外。
- provider-native metrics ingestion と advanced lifecycle policy tuning は follow-up。
- `make validate` では既存の React test から `act(...)` warning が stderr に出るが、suite 自体は pass している。
