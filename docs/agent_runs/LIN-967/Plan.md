# Plan.md

## Milestones

### M1. Terraform baseline
- helm provider を root へ追加
- standard path 向け Argo CD / Argo Rollouts install module を追加
- staging / prod root に opt-in wiring と outputs を追加

### M2. GitOps repo layout
- sample rollout app を `infra/gitops/apps` に追加
- AppProject / Application bootstrap manifest を `infra/gitops/bootstrap` に追加
- render validate の make target / CI step を追加

### M3. Docs and delivery
- runbook / README / decisions を更新
- validation を実行
- PR / Linear を更新
