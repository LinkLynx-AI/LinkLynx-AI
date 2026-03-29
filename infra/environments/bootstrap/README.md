# Bootstrap Environment

この root は **local state** で最初に apply する。

## 何を作るか

- bootstrap project (`linklynx-bootstrap`)
- Terraform remote state bucket
- Terraform admin service account
- `staging` / `prod` project baseline
- `infra/environments/staging/backend.hcl`
- `infra/environments/prod/backend.hcl`
- GitHub Actions 用 workload identity provider
- `staging` / `prod` Artifact Registry publisher service account
- `prod` Terraform deployer service account

## 手順

```bash
cd infra/environments/bootstrap
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform apply
```

apply が成功すると、後続 environment root が使う `backend.hcl` が生成される。
加えて、GitHub Actions 側へ入れるべき次の output が取れる。

- `github_actions_workload_identity_provider_name`
- `github_artifact_publisher_service_account_emails`
- `github_terraform_deployer_service_account_emails`

## 必要な前提

- billing account への紐付け権限
- project 作成権限
- target organization または folder への作成権限
- GitHub repository `LinkLynx-AI/LinkLynx-AI` を workload identity provider に許可する前提
