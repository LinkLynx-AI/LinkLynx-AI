# Documentation.md (Status / audit log)

## Current status
- Now: LIN-962 の Terraform bootstrap baseline 実装と repo 側の検証まで完了
- Next: Terraform 実行環境と GCP 権限がある場所で `infra/environments/bootstrap` の `plan/apply` を確認する

## Decisions
- Branch: `codex/lin-962-gcp-bootstrap-terraform-state`
- Start mode: child issue start
- Terraform は repo 内に新設する
- runtime 環境は `staging` / `prod` のままにし、state backend と admin service account は dedicated bootstrap project に置く
- first apply は bootstrap root の local state で実行し、その apply で後続 env 用 `backend.hcl` を生成する
- bootstrap baseline は `linklynx-bootstrap` project, shared GCS state bucket, `terraform-admin` service account を基準にする
- runtime project baseline には budget alert, baseline API enablement, and later env root scaffold を含める
- CI に Terraform format / validate job を追加し、root `make validate` とは分離して扱う

## How to run / demo
- `make validate`
- `make infra-fmt`
- `make infra-validate`
- `cd infra/environments/bootstrap && terraform init && terraform apply`
- `cd infra/environments/staging && terraform init -backend-config=backend.hcl && terraform plan`

## Validation results
- `make validate`: pass
- `git diff --check`: pass
- `make infra-fmt`: failed as expected in this environment because `terraform` binary is not installed
- Docker 経由の Terraform validation も試行前提を確認したが、`hashicorp/terraform:1.6.6` image はローカルに存在しなかった

## Known issues / follow-ups
- この環境では `terraform` binary が未導入のため、`terraform fmt/validate/plan` は未実行
- 実 GCP apply は billing account / org or folder 権限がある環境で行う必要がある
- `roles/owner` を使う bootstrap admin service account は初期速度優先の baseline であり、権限の絞り込みは後続 issue で検討余地がある
