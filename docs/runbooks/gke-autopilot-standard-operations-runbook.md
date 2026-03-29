# GKE Autopilot Standard Operations Runbook

## Purpose

`LIN-964` の標準 path として、`staging` / `prod` に 1 cluster ずつ置く GKE Autopilot baseline を運用・検証・rollback するための手順を固定する。

## Baseline

- cluster: `staging` / `prod` に 1 つずつ
- release channel: `REGULAR`
- namespace baseline:
  - `frontend`
  - `api`
  - `ai`
  - `data`
  - `ops`
  - `observability`
- restricted ingress baseline:
  - `data`
  - `ops`
  - `observability`
- RBAC baseline:
  - `ops` namespace に read-only service account `ops-viewer`

## Autoscaling policy

- 初期は `VPA primary / HPA later`
- `frontend` / `api` は通常 capacity 前提
- `ai` は batch / async 化が進んだ時点で spot-ready 扱い
- `data` / `ops` / `observability` は manual change を前提にする

この issue では workload target がまだないため、`VerticalPodAutoscaler` object 自体は作らない。VPA は namespace label と運用ポリシーで先に固定する。

## Verify

### 1. Terraform baseline

```bash
terraform fmt -check -recursive infra
PATH=/tmp/terraform_1.6.6:$PATH make infra-validate
make validate
```

### 2. Cluster and namespace baseline

```bash
kubectl config current-context
kubectl get ns
kubectl get serviceaccount -n ops
kubectl get networkpolicy -A
kubectl get resourcequota -A
```

期待値:

- namespace baseline が揃っている
- `ops-viewer` service account が存在する
- `data` / `ops` / `observability` に restricted ingress baseline が存在する
- GKE-managed `gke-resource-quotas` が見える場合は cluster quota baseline として扱う

### 3. RBAC baseline

```bash
kubectl auth can-i get pods --as=system:serviceaccount:ops:ops-viewer -A
kubectl auth can-i create deployments --as=system:serviceaccount:ops:ops-viewer -A
```

期待値:

- `get pods`: yes
- `create deployments`: no

### 4. Control plane / autoscaling visibility

```bash
kubectl get events -A --sort-by=.lastTimestamp | tail -n 50
gcloud container clusters describe <cluster-name> --region us-east1 --project <project-id>
```

期待値:

- cluster が `AUTOPILOT` として作成されている
- autoscaling / scheduling error があれば event で追える

## Rollback

### staging

1. `enable_standard_gke_cluster_baseline = false`
2. `terraform apply`
3. namespace / cluster が片付くことを確認する

### prod

1. workload drain と切り戻し順を先に確認する
2. `enable_standard_gke_cluster_baseline = false`
3. `terraform apply`
4. 既存 workload が low-budget path へ戻るか、別 cluster へ退避済みであることを確認する

## HPA migration conditions

- CPU / memory / queue length / concurrency に安定した signal がある
- VPA recommendation が一定期間収束している
- scale-out で守る SLO が明確
- rollback 時に fixed request へ戻せる

## Follow-up boundary

- real workload 向け VPA object
- HPA tuning
- spot workload placement
- cluster-wide default deny
- Pod Security Admission
- `master_authorized_networks` や private control plane hardening

`LIN-973` では security baseline と audit posture を先に固定し、control plane access model 自体の再設計はこの boundary に残す。

これらは `LIN-965` / `LIN-967` / `LIN-972` / `LIN-973` へ渡す。
