# Staging Environment

この root は LIN-963 以降の staging infrastructure 用。

## 初期化

bootstrap apply 後に生成された `backend.hcl` を使う。

```bash
cd infra/environments/staging
terraform init -backend-config=backend.hcl
terraform plan
```

## LIN-963 時点の構成

- `network_foundation` module を呼び、次を staging project 内に作る
  - custom mode VPC
  - GKE node subnet + pods/services secondary ranges
  - `db-private`, `proxy-only`, `psc` subnet
  - private services access reserved range + peering
  - Cloud Armor baseline policy
  - Cloud DNS public zone, reserved global IPv4, Certificate Manager resources
- `artifact_registry_repository` module を呼び、`application-images` Docker repository を作る
- GKE Ingress resource 自体はこの issue では作らず、後続 cluster / smoke deploy issue で attach する
- main path に `API Gateway` は置かない

## LIN-1014 low-budget path

- 月 `1万円` 前後の初期予算 path では、staging 常設 cluster は作らない
- staging は次で代替する
  - local 開発
  - preview 環境
  - 必要時のみの一時 cluster
- 常設 staging cluster が必要になったら、標準 path の `LIN-964` 相当へ拡張する

## tfvars で埋める値

- `public_dns_zone_name`
- `public_dns_name`
- `public_hostnames`
- `artifact_registry_repository_id` (default `application-images`)

staging の最小 smoke deploy は `api.<staging-domain>` だけ先に作れば十分。
