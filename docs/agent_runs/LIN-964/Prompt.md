# Prompt.md (Spec / Source of truth)

## Goals
- `LIN-964` として、standard path の `staging` / `prod` GKE Autopilot cluster baseline を Terraform 化する
- namespace / RBAC / restricted ingress の最小 baseline を cluster と分離して再利用可能にする
- VPA primary / HPA later の運用境界を code/docs で固定する

## Non-goals
- domain ごとの cluster 分離
- HPA tuning や負荷試験
- workload ごとの real VPA object
- private control plane や full hardening

## Deliverables
- `infra/modules/gke_autopilot_standard_cluster`
- `infra/modules/gke_namespace_baseline`
- `staging` / `prod` からの wiring
- standard GKE runbook / README / decision doc 更新

## Done when
- [ ] standard path 用 cluster baseline を `staging` / `prod` で opt-in できる
- [ ] namespace / RBAC / restricted ingress baseline が Terraform で再現できる
- [ ] VPA primary / HPA later の方針が docs に明記される
- [ ] low-budget path と standard path の排他条件が `prod` で明示される

## Constraints
- Perf: `make validate`, `terraform fmt -check -recursive infra`, `make infra-validate` を通す
- Security: low-budget path を壊さず、namespace 境界は restricted ingress baseline で先に固定する
- Compatibility: `prod` では low-budget cluster と standard cluster を同時有効化しない
