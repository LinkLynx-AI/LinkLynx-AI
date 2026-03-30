# Prompt.md (Spec / Source of truth)

## Goals
- `LIN-963` として `us-east1` 前提の VPC / subnet / DNS / TLS / edge baseline を Terraform 化する。
- `staging` / `prod` の environment root から共通 module を呼び、後続の GKE / DB issue が使えるネットワーク土台を整える。
- main path に `API Gateway` を置かない方針をコードと docs で明示する。

## Non-goals
- GKE クラスタ作成や namespace 設定までは進めない。
- 実アプリのデプロイや Ingress controller の apply は行わない。
- 将来の multi-region 分を先回りで実装しない。

## Deliverables
- `infra/modules/network_foundation` の追加。
- `infra/environments/staging` / `prod` からの module wiring。
- DNS / TLS / Cloud Armor / reserved IP / private service access などの foundation resources。
- `infra/README.md` と environment README の更新。

## Done when
- [ ] 指定 CIDR に沿った VPC / subnet が Terraform で再現可能。
- [ ] `staging` / `prod` の DNS / TLS / edge responsibility が code/docs で一致。
- [ ] `API Gateway は main path では不要` が docs で明示。
- [ ] 後続 `LIN-964`, `LIN-968`, `LIN-970`, `LIN-1013` が参照できる outputs を持つ。

## Constraints
- Perf: validation は `terraform fmt -check`, `make infra-validate`, `make validate` を通す。
- Security: public DNS / cert / WAF は GCP native edge baseline に合わせる。
- Compatibility: `main` に未マージの `LIN-961` 差分と競合しやすい docs は最小更新に留める。
