# Staging Rust API Smoke Deploy Operations Runbook

## Purpose

`LIN-1013` の baseline として、`staging` standard cluster 上に Terraform-managed の Rust API smoke workload を出し、
`/health` と `/ws` を verify / rollback する手順を固定する。

## Scope

In scope:

- `terraform apply` で再現できる最小の staging Rust API smoke deploy
- Gateway API 経由の `GET /health` verify
- `wss://` upgrade verify
- image digest の roll-forward / rollback

Out of scope:

- GitOps / Argo CD promotion
- Workload Identity / Secret Manager runtime access
- Cloud SQL / Scylla / Dragonfly などの本接続

## Prerequisites

- `LIN-963`, `LIN-964`, `LIN-966` が反映済み
- `enable_standard_gke_cluster_baseline = true`
- `rust_api_image_digest` が Artifact Registry の digest で埋まっている
- `public_hostnames` または `rust_api_public_hostname` が埋まっている
- `backend.hcl` と staging 用 credentials / impersonation が使える

## Terraform inputs

- `enable_rust_api_smoke_deploy = true`
- `rust_api_public_hostname = "api.staging.example.com"`
- `rust_api_image_digest = "us-east1-docker.pkg.dev/linklynx-staging/application-images/rust@sha256:<digest>"`

## Apply

```bash
cd infra/environments/staging
terraform init -backend-config=backend.hcl
terraform plan
terraform apply
```

## Verify

### 1. Terraform / repo validation

```bash
terraform fmt -check -recursive ../../..
PATH=/tmp/terraform_1.6.6:$PATH make -C ../../.. infra-validate
make -C ../../.. validate
```

### 2. Cluster resources

```bash
kubectl get ns rust-api-smoke
kubectl -n rust-api-smoke get deploy,svc,gateway,httproute
kubectl -n rust-api-smoke get healthcheckpolicy
kubectl -n rust-api-smoke rollout status deploy/rust-api-smoke
```

期待値:

- `rust-api-smoke` namespace が存在する
- Deployment / Service / Gateway / HTTPRoute / HealthCheckPolicy が作成される
- rollout が完了する

### 3. Public health path

```bash
curl -i -sS https://<stg_api_host>/health
```

期待値:

- `HTTP/2 200`
- body は current app baseline の `OK`

### 4. Public WebSocket path

```bash
wscat -c wss://<stg_api_host>/ws
```

期待値:

- upgrade が成功する
- connection がすぐに close されない

## Roll-forward / rollback

### Roll-forward

1. `rust_api_image_digest` を新しい digest に更新する
2. `terraform apply`
3. `kubectl -n rust-api-smoke rollout status deploy/rust-api-smoke`
4. `/health` と `/ws` を再確認する

### Rollback

1. `rust_api_image_digest` を直前の digest に戻す
2. `terraform apply`
3. `kubectl -n rust-api-smoke rollout status deploy/rust-api-smoke`
4. `/health` と `/ws` を再確認する

## Destroy / disable

一時的に smoke workload を消す場合は次を使う。

1. `enable_rust_api_smoke_deploy = false`
2. `terraform apply`

これで `rust-api-smoke` namespace 配下の workload / route が削除される。

## Handoff boundary to LIN-967

- この runbook は Terraform-managed smoke deploy のための暫定 baseline
- controller-managed promotion / canary / sync history は `LIN-967` の GitOps baseline へ引き継ぐ
- `LIN-967` に移るときも、最初の external `/health` と `/ws` verify はこの runbook の手順を再利用してよい
