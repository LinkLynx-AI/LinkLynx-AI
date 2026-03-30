# Prompt.md (Spec / Source of truth)

## Goals
- low-budget path に合わせて `prod` GKE Autopilot 上へ Rust API smoke workload を Terraform だけで出せるようにする
- image は Artifact Registry digest 参照に固定する
- `GET /health` と `GET /ws` を prod public host から通せる最小経路を用意する

## Non-goals
- staging cluster の追加
- Argo CD / Argo Rollouts の導入
- Cloud SQL や外部データストアとの本接続
- Secret Manager / External Secrets の本格導入

## Deliverables
- prod environment で使う Kubernetes provider wiring
- Rust API smoke workload module
- apply / rollback / verify 手順の documentation

## Done when
- [ ] prod root から Terraform だけで smoke workload を定義できる
- [ ] image digest の更新で roll-forward / rollback できる
- [ ] `/health` / `/ws` の確認手順が残る
- [ ] `make validate` と issue-specific Terraform checks が通る

## Constraints
- Perf: 低予算 baseline の `500m CPU / 512Mi memory / 1Gi ephemeral storage` を崩さない
- Security: mutable tag に依存しない。長期静的 key は増やさない
- Compatibility: `LIN-1014` の prod-only cluster baseline と `LIN-966` の publish flow に沿う
