# Prompt.md (Spec / Source of truth)

## Goals
- low-budget `prod-only` path に合わせて Workload Identity + Secret Manager の最小 baseline を Terraform 化する
- Rust API smoke workload が将来の実 secret を安全に読める KSA / GSA / IAM パターンを先に整える
- secret rotation と audit log 確認まで迷わない runbook を残す

## Non-goals
- 各アプリ固有 secret の実値管理
- External Secrets Operator や Argo CD 連携
- staging 常設 cluster 前提の検証導線

## Deliverables
- prod root で使う workload identity / secret access module
- Rust API smoke workload への GSA annotation wiring
- Secret Manager / audit log / rotation runbook

## Done when
- [ ] prod-only path で workload 単位の権限分離が Terraform で表現されている
- [ ] Secret Manager secret placeholder と accessor policy が定義されている
- [ ] repo / CI に長期静的キーを置かない運用が docs に反映されている
- [ ] validation と docs 更新が完了している
