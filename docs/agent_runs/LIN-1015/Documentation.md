# Documentation.md (Status / audit log)

## Current status
- Now: LIN-1015 の実装と validation は完了。PR 化の最終整理中
- Next: self-review を反映して commit / push / PR を作る

## Decisions
- low-budget path の次 issue として `LIN-1015` を新規起票し、`LIN-1013` の staging 前提とは切り分ける
- edge は `GCP native edge` 方針に沿い、prod public host と Gateway route を Terraform 管理に置く
- digest が未指定のときは smoke workload を作らず、prod apply の明示操作を必須にする
- `enable_rust_api_smoke_deploy = true` なのに digest / hostname / edge prerequisites が不足している場合は Terraform `check` で fail-fast させる
- cluster create と workload deploy は同一 root だが、初回は `LIN-1014` apply 後に `LIN-1015` を有効化する 2 段階運用を前提にする

## How to run / demo
- `LIN-1014` と `LIN-966` が apply / 実行済みの前提で prod tfvars に image digest を入れて apply する
- apply 後に `curl https://<prod_api_host>/health` と `wscat` で `/ws` を確認する
- rollback は `rust_api_image_digest` を直前 digest に戻して再 apply する

## Validation log
- `terraform fmt -check -recursive infra`
- `PATH=/tmp/terraform_1.6.6:$PATH make infra-validate`
- `make validate`
- `git diff --check`

## Local plan note
- `terraform -chdir=infra/environments/prod plan ...` は、この workspace に backend 用 `backend.hcl` がなく、root に `backend "gcs" {}` があるため、そのままでは local plan を安定再現できなかった
- `TF_DATA_DIR` を分けた試行でも `Backend initialization required` に戻るため、issue では `validate` までをローカル gate とし、実 plan/apply は bootstrap 後の実環境で確認する前提にした

## Known issues / follow-ups
- 実 cluster / 実ドメインがない local workspace では actual apply はできない
