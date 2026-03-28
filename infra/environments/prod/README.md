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

## tfvars で埋める値

- `public_dns_zone_name`
- `public_dns_name`
- `public_hostnames`

prod は `api.<domain>` を起点にし、後続 issue で必要な host を追加する。
