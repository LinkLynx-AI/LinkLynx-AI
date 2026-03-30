# Prompt.md (Spec / Source of truth)

## Goals
- `LIN-1013` として、`staging` standard cluster 上の Rust API smoke deploy を Terraform だけで再現できるようにする。
- `GET /health` と `GET /ws` の staging 公開疎通を、digest-based deploy / rollback とあわせて手順化する。
- 将来 `LIN-967` の GitOps path へ移る前の暫定 smoke deploy baseline を小さく閉じる。

## Non-goals
- `prod` への本番 deploy
- Argo CD / Argo Rollouts の導入
- Secret Manager / Workload Identity の本格導入
- Cloud SQL / Scylla / Dragonfly / messaging との本接続

## Deliverables
- staging root の Terraform smoke deploy baseline
- staging smoke deploy runbook
- staging / infra docs 更新
- `docs/agent_runs/LIN-1013/` memory

## Done when
- [x] `terraform apply` のみで staging Rust API smoke workload を再現できる
- [x] `GET /health` の verify / rollback 手順が残る
- [x] `GET /ws` の verify / rollback 手順が残る
- [x] image digest の roll-forward / rollback が docs に残る
- [x] `make validate` が通る
- [x] `git diff --check` が通る

## Constraints
- Scope は Terraform-managed smoke deploy に限定し、GitOps や runtime secrets は混ぜない。
- image reference は tag ではなく digest を使う。
- edge は `GCP native edge`、cluster は `LIN-964` の standard staging cluster を前提にする。
