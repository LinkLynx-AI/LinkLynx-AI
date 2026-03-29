# Argo CD / Argo Rollouts Standard Operations Runbook

## Scope

- standard path (`staging` / `prod`) の GitOps baseline
- controller install は Terraform、AppProject / Application bootstrap は repo 上の kustomize manifest
- rollout sample は `infra/gitops/apps/*/canary-smoke`

## Baseline

- Argo CD namespace: `ops`
- Argo CD release: `argocd`
- Argo Rollouts release: `argo-rollouts`
- AppProject: `linklynx-platform`
- staging app: `staging-canary-smoke`
  - source path: `infra/gitops/apps/staging/canary-smoke`
  - sync policy: automated
- prod app: `prod-canary-smoke`
  - source path: `infra/gitops/apps/prod/canary-smoke`
  - sync policy: manual

## Install order

1. Terraform で standard cluster baseline を apply する
2. Terraform で standard GitOps baseline を apply する
3. bootstrap manifest を apply する

```bash
terraform output standard_gitops_baseline
kubectl apply -k infra/gitops/bootstrap/staging
kubectl apply -k infra/gitops/bootstrap/prod
```

## Verify

```bash
kubectl -n ops get pods
kubectl -n ops get applications.argoproj.io
kubectl -n api get rollout canary-smoke
kubectl argo rollouts get rollout canary-smoke -n api
```

- staging app は `Synced` / `Healthy` になること
- prod app は bootstrap 後に `OutOfSync` でもよい。manual sync gate を通すまでは自動反映しない

## Promotion flow

1. staging overlay (`infra/gitops/apps/staging/canary-smoke`) を更新して merge
2. Argo CD が staging を auto sync
3. smoke / metrics / logs を確認
4. prod overlay (`infra/gitops/apps/prod/canary-smoke`) に同じ変更を別 PR で反映
5. human review 後に merge
6. Argo CD UI もしくは CLI で prod app を manual sync

## Canary progression

- `10% -> pause 60s`
- `50% -> pause 120s`
- `100%`

`canary-smoke` は sample workload。実サービスへ置き換えるときも、まずこの段階配信テンプレートを踏襲する。

## Pause / resume

```bash
kubectl argo rollouts pause canary-smoke -n api
kubectl argo rollouts promote canary-smoke -n api
kubectl argo rollouts resume canary-smoke -n api
```

## Rollback

```bash
kubectl argo rollouts abort canary-smoke -n api
kubectl argo rollouts undo canary-smoke -n api
```

- Argo CD sync 自体を止めたい場合は、staging/prod の Application から automated sync を外す
- prod は baseline で manual sync のため、rollback は manifest revert + manual sync を基本にする

## Drift / emergency stop

```bash
kubectl -n ops get application staging-canary-smoke -o yaml
kubectl -n ops get application prod-canary-smoke -o yaml
```

- unexpected drift があるときは、まず Argo CD UI で auto sync を停止する
- cluster 側 hotfix が必要な場合は hotfix 後に必ず Git 側へ反映する

## Follow-ups

- repo credential 管理が必要になった場合は別 issue で Argo CD repo secret を追加する
- real service への置き換え時は image digest promotion と analysis template を追加する
