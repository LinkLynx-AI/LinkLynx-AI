# Documentation.md (Status / audit log)

## Current status
- Now: `LIN-1024` の managed messaging secret baseline 実装と validation が完了
- Next: commit / push / PR 作成と Linear の `In Review` 更新を行う

## Decisions
- low-budget path では runtime client より先に Secret Manager inventory を固定する
- non-secret 寄りの connection material も Secret Manager に寄せ、将来の runtime retrieval path を一本化する

## How to run / demo
- `enable_minimal_managed_messaging_secret_baseline = true` を設定する
- Terraform `plan/apply` 後に secret version を追加する
- outputs と `gcloud secrets describe` で inventory を確認する

## Known issues / follow-ups
- Redpanda / NATS の runtime wiring はこの issue の対象外
- standard path の `LIN-971` で actual connection baseline を続ける

## Validation log
- `terraform fmt -check -recursive infra`
- `PATH=/tmp/terraform_1.6.6:$PATH make infra-validate`
- `make validate`
- `git diff --check`

## Review notes
- infra / docs 変更のみで UI 変更なし
- runtime client / broker provisioning は含めず Secret Manager inventory に限定
- `make validate` 中の既知 React `act(...)` warning は今回差分起因ではない
