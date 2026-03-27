# Prompt.md (Spec / Source of truth)

## Goals
- LIN-962 の scope に沿って GCP bootstrap と Terraform state 基盤を repo に追加する
- `staging` / `prod` の GCP project baseline を Terraform で再現できる形にする
- 後続 issue が共通 state backend と naming convention を再利用できるようにする

## Non-goals
- GKE cluster, VPC, LB, DNS, TLS の実装
- アプリのデプロイや GitOps 導入
- 実運用 secret 値や workload identity の詳細設計

## Deliverables
- `infra/` 配下の Terraform bootstrap 構成
- GCP project / state backend / budget / admin service account baseline
- 命名規約と apply 手順のドキュメント

## Done when
- [x] `staging` / `prod` の bootstrap baseline が Terraform で表現されている
- [x] Terraform state backend 用 bucket と backend 共有方法が定義されている
- [x] naming / budget / admin service account の基準が文書化されている
- [x] 後続 issue が使う environment root 雛形がある

## Constraints
- Perf: runtime リソースは作らない
- Security: state bucket は公開しない。admin 権限の用途を限定して記録する
- Compatibility: 後続 issue が `infra/environments/staging` / `prod` をそのまま拡張できる
