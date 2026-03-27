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
- GKE Ingress resource 自体はこの issue では作らず、後続 cluster / smoke deploy issue で attach する
- main path に `API Gateway` は置かない

## tfvars で埋める値

- `public_dns_zone_name`
- `public_dns_name`
- `public_hostnames`

staging の最小 smoke deploy は `api.<staging-domain>` だけ先に作れば十分。
