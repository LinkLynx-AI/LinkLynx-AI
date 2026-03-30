# Prompt.md (Spec / Source of truth)

## Goals
- `Artifact Registry` を staging / prod の runtime project に整備する
- GitHub Actions から service account key なしで image build / publish できるようにする
- immutable tag / digest 参照の規約を決めて document 化する
- build failure と高重大度脆弱性の検知 baseline を入れる

## Non-goals
- GKE への deploy
- Argo CD / Argo Rollouts の導入
- rollout 制御や image promotion の完全自動化

## Deliverables
- Terraform で管理される Artifact Registry repository baseline
- GitHub OIDC -> GCP Workload Identity Federation 認証経路
- GitHub Actions build / publish workflow
- image naming / tag policy / promotion flow を説明する documentation

## Done when
- [ ] GitHub Actions から `Artifact Registry` に image を push できる
- [ ] mutable tag に依存しない tag / digest policy が document 化されている
- [ ] 高重大度脆弱性を workflow で検知できる
- [ ] `make validate` と `make infra-validate` が通る

## Constraints
- Perf: build/publish は後続 deploy issue の blocker を外す最小構成に留める
- Security: long-lived service account key は作らない
- Compatibility: 低予算 path の `prod only` GKE baseline を壊さない
