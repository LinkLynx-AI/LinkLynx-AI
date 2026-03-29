# Production Environment

この root は LIN-963 以降の production infrastructure 用。

## 初期化

bootstrap apply 後に生成された `backend.hcl` を使う。

```bash
cd infra/environments/prod
terraform init -backend-config=backend.hcl
terraform plan
```

## LIN-963 時点の構成

- `network_foundation` module を呼び、次を prod project 内に作る
  - custom mode VPC
  - GKE node subnet + pods/services secondary ranges
  - `db-private`, `proxy-only`, `psc` subnet
  - private services access reserved range + peering
  - Cloud Armor baseline policy
  - Cloud DNS public zone, reserved global IPv4, Certificate Manager resources
- `artifact_registry_repository` module を呼び、`application-images` Docker repository を作る
- GKE Ingress resource 自体はこの issue では作らず、後続 cluster / workload issue で attach する
- main path に `API Gateway` は置かない

## LIN-1014 low-budget path

- `enable_minimal_gke_cluster = true` で **prod only** の GKE Autopilot cluster を作る
- `staging` 常設 cluster は作らず、local / preview / 必要時の一時環境で代替する
- 初期の workload baseline は Rust API 1本に絞る
  - CPU request: `500m`
  - Memory request: `512Mi`
  - Ephemeral storage request: `1Gi`
- VPA は recommendation-only 前提とし、自動 apply は後続 issue に回す

### 低予算 path から標準 path へ拡張する条件

- staging 常設環境がないと release safety を維持できなくなったとき
- Next.js / Python が常時稼働前提になり、prod only 1 cluster では運用しづらくなったとき
- HPA を入れたいだけの観測データが揃ったとき

## LIN-1015 prod-only Rust API smoke deploy

`LIN-1015` は `LIN-1014` の cluster を使って、最初の Rust API workload を Terraform で出す。

### 使う変数

- `enable_rust_api_smoke_deploy`
- `rust_api_image_digest`
- `rust_api_public_hostname`

default では `enable_rust_api_smoke_deploy = false` にしている。
cluster 作成後に digest と hostname が揃ってから明示的に `true` へ切り替える。
`true` のまま前提値が足りない場合は Terraform `check` で apply を止める。

### 作られるもの

- namespace: `rust-api-smoke`
- Kubernetes ServiceAccount / Deployment / Service
- Gateway API:
  - `Gateway`
  - `HTTPRoute`
  - `HealthCheckPolicy`

### 運用メモ

- Gateway は `LIN-963` で確保した named static IP と certificate map を使う
- 最初の有効化は `LIN-1014` cluster apply 後の 2 段階目 apply として実施する
- image は tag ではなく Artifact Registry digest を使う
- rollback は `rust_api_image_digest` を直前 digest に戻して `terraform apply` する

## tfvars で埋める値

- `public_dns_zone_name`
- `public_dns_name`
- `public_hostnames`
- `artifact_registry_repository_id` (default `application-images`)

prod は `api.<domain>` を起点にし、後続 issue で必要な host を追加する。
