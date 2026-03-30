# Prompt.md (Spec / Source of truth)

## Goals
- `LIN-1014` として、月額 `1万円` 前後の初期予算に合わせた `prod only` GKE Autopilot 最小基盤を Terraform 化する。
- `LIN-963` の network foundation を利用して、prod project のみ常設 cluster を持つ low-budget path を作る。
- `staging 常設クラスタなし` と `fixed request / VPA recommendation-only` の初期運用方針を code/docs に明示する。

## Non-goals
- `staging + prod` の 2 クラスタ構成にはしない。
- Next.js / Python / Dragonfly まで同居前提にはしない。
- HPA 自動化や本番負荷試験までは進めない。

## Deliverables
- `infra/modules/gke_autopilot_minimal`
- `infra/environments/prod` からの prod-only module wiring
- low-budget GKE baseline を説明する README 更新
- `docs/agent_runs/LIN-1014/` の実行メモ

## Done when
- [ ] prod only の GKE Autopilot cluster が Terraform で再現可能
- [ ] low-budget 前提の namespace / naming / resource request baseline が docs にある
- [ ] `staging 常設クラスタなし` が code/docs で明示されている
- [ ] `LIN-964` 標準構成へ拡張する条件が記載されている

## Constraints
- Perf: validation は `terraform fmt -check`, `make infra-validate`, `make validate` を通す
- Security: low-budget path でも custom node service account を使い、main path を汚さない
- Compatibility: `LIN-963` PR 上に積む stacked branch として差分を閉じる
