# Documentation.md (Status / audit log)

## Current status
- Now: Workload Identity / Secret Manager baseline の実装と validation は完了
- Next: self-review をまとめて commit / PR 化する

## Decisions
- `LIN-965` は標準 path 用に backlog へ戻し、low-budget sibling として `LIN-1016` を新規起票した
- low-budget path では ESO ではなく、Workload Identity + direct Secret Manager access を最初の標準パターンにする
- Secret access は project-wide IAM ではなく secret-level `roles/secretmanager.secretAccessor` に限定する
- Secret Manager の access event を追えるように `secretmanager.googleapis.com` の `ADMIN_READ` / `DATA_READ` audit log baseline を prod root に置く
- Workload Identity を使う path では KSA token automount を有効化する

## How to run / demo
- prod cluster と Rust API smoke workload baseline (`LIN-1014`, `LIN-1015`) がある前提で Terraform apply する
- apply 後に KSA annotation, secret IAM, audit logs filter を確認する
- 実 secret value は後続で version を追加し、runbook に従って rotation / rollback を行う

## Validation log
- `terraform fmt -check -recursive infra`
- `PATH=/tmp/terraform_1.6.6:$PATH make infra-validate`
- `make validate`
- `git diff --check`

## Local plan note
- `prod` root は `backend "gcs" {}` を持つため、この workspace に `backend.hcl` がない状態では local `terraform plan` を安定再現できない
- この issue でも local gate は `fmt` / `validate` までとし、実 plan / apply は bootstrap 後の実環境で確認する前提にする

## Known issues / follow-ups
- 実 secret version の投入と runtime での読み出し自体は後続 app issue に委ねる
