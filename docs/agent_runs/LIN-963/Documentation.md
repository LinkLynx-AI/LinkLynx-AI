# Documentation.md (Status / audit log)

## Current status
- Now: Terraform / docs 実装と validation まで完了。PR 準備に入る。
- Next: self-review を通して commit / PR を作る。

## Decisions
- `LIN-963` は runtime workload ではなく shared network / edge foundation に限定する。
- DNS / TLS は actual domain 未確定のため variable-driven にする。
- reserved public IPv4 は domain 未確定でも先に確保する。
- `db-private /24` は subnet として確保し、Cloud SQL など producer service 向け PSA range は別の reserved peering range として管理する。
- main path に `API Gateway` は置かず、GCP native edge baseline は `Cloud DNS / Certificate Manager / Cloud Armor / External Application Load Balancer` に寄せる。

## How to run / demo
- `terraform fmt -check -recursive infra`
- `make infra-validate`
- `make validate`
- `terraform -chdir=infra/environments/staging plan` は `backend.hcl` と実ドメイン値が必要。今回の local run では backend 未初期化のため未実施。

## Known issues / follow-ups
- `LIN-961` の GCP native edge ADR は PR 済みだが main 未反映。競合しやすい docs 更新は最小限に留める。
- 実ドメインが未確定のため、`terraform plan` には environment tfvars の補完が必要。
- Homebrew の `terraform` formula は `1.5.7` で止まるため、local infra validation は一時的に `/tmp/terraform_1.6.6/terraform` を利用した。

## Validation log
- Passed: `terraform fmt -check -recursive infra`
- Passed: `make infra-validate` with `PATH=/tmp/terraform_1.6.6:$PATH`
- Passed: `make validate`
- Skipped: `terraform plan` against real backend because `backend.hcl` is not generated in this local workspace and actual DNS values are placeholders
