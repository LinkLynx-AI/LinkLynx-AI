# Bootstrap Environment

この root は **local state** で最初に apply する。

## 何を作るか

- bootstrap project (`linklynx-bootstrap`)
- Terraform remote state bucket
- Terraform admin service account
- `staging` / `prod` project baseline
- `infra/environments/staging/backend.hcl`
- `infra/environments/prod/backend.hcl`

## 手順

```bash
cd infra/environments/bootstrap
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform apply
```

apply が成功すると、後続 environment root が使う `backend.hcl` が生成される。

## 必要な前提

- billing account への紐付け権限
- project 作成権限
- target organization または folder への作成権限
