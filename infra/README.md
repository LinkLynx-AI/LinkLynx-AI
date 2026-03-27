# Infra Bootstrap

LIN-962 では、GCP bootstrap と Terraform remote state の最小土台をこの `infra/` 配下に追加する。

## 目的

- `staging` / `prod` の GCP project baseline を Terraform で再現可能にする
- 後続 issue が共通 state backend を使えるようにする
- naming convention, budget baseline, admin service account を最初に固定する

## ディレクトリ構成

```text
infra/
├── modules/
│   ├── project_baseline/
│   └── state_backend/
└── environments/
    ├── bootstrap/
    ├── staging/
    └── prod/
```

## 命名規約

| 種別 | 規約 | 例 |
| --- | --- | --- |
| Project prefix | `<project_prefix>` | `linklynx` |
| Bootstrap project | `<project_prefix>-bootstrap` | `linklynx-bootstrap` |
| Runtime project | `<project_prefix>-<env>` | `linklynx-staging`, `linklynx-prod` |
| State bucket | `<project_prefix>-tfstate-<suffix>` | `linklynx-tfstate-a1b2` |
| Terraform admin service account | `<account_id>@<bootstrap-project>.iam.gserviceaccount.com` | `terraform-admin@linklynx-bootstrap.iam.gserviceaccount.com` |
| State prefix | `env/<env>` | `env/staging`, `env/prod` |

## Terraform admin role baseline

`roles/owner` は採用しない。初期 baseline は override 可能な curated predefined roles に絞る。
bootstrap root を実行する人間または CI principal が folder / billing / project 作成権限を持ち、`terraform-admin` service account 自体にはそれらの organization-scope 権限を default 付与しない。

| Scope | Baseline roles |
| --- | --- |
| Bootstrap project | `roles/storage.admin`, `roles/serviceusage.serviceUsageAdmin`, `roles/iam.serviceAccountAdmin`, `roles/resourcemanager.projectIamAdmin` |
| Runtime project | `roles/compute.admin`, `roles/container.admin`, `roles/dns.admin`, `roles/certificatemanager.editor`, `roles/cloudsql.admin`, `roles/artifactregistry.admin`, `roles/secretmanager.admin`, `roles/serviceusage.serviceUsageAdmin`, `roles/iam.serviceAccountAdmin`, `roles/resourcemanager.projectIamAdmin` |

## Budget baseline

初期値は Terraform 変数で上書き可能だが、baseline は次を採用する。

| Environment | Monthly budget (JPY) |
| --- | ---: |
| `staging` | `300000` |
| `prod` | `1500000` |

閾値は `50% / 80% / 100%` を baseline とする。

## Bootstrap flow

1. `infra/environments/bootstrap` を local state で apply する
2. bootstrap project, state bucket, admin service account, `staging` / `prod` project baseline を作る
3. 同じ apply で `infra/environments/staging/backend.hcl` と `infra/environments/prod/backend.hcl` を生成する
4. 後続 issue では各 environment root で `terraform init -backend-config=backend.hcl` を使う

この流れにより、最初の state backend 作成以外で clickops を増やさずに進められる。

## Security notes

- state bucket は `uniform_bucket_level_access = true` と `public_access_prevention = "enforced"` を前提にする
- versioning を有効化する
- 必要なら `state_bucket_kms_key_name` で CMEK を有効化できる
