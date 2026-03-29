# Documentation.md (Status / audit log)

## Current status
- Now: Cloud SQL baseline module と runbook の実装、validation は完了
- Next: self-review をまとめて commit / PR 化する

## Decisions
- 標準 `LIN-968` とは別に、low-budget sibling として `LIN-1017` を起票した
- low-budget path では `prod-only` / single instance / no HA / no read replica を baseline にする
- app 接続や migration executor の具体接続方式は後続 issue に分離する
- Cloud SQL baseline では password / `DATABASE_URL` の実値を Terraform 管理せず、instance と運用境界だけ先に固定する
- local `terraform plan` は一時 workspace で backend stanza を外せば module 解決までは進むが、最終的には ADC 不在で停止する

## Validation log
- `terraform fmt -check -recursive infra`
- `PATH=/tmp/terraform_1.6.6:$PATH make infra-validate`
- `make validate`
- `git diff --check`
- `terraform plan`
  - 一時 workspace で backend stanza を外した検証では module 解決まで成功
  - 最終的には `google` provider の ADC 不在で停止 (`could not find default credentials`)
