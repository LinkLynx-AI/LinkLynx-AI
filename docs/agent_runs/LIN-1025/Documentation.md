# Documentation.md (Status / audit log)

## Current status
- Now: `LIN-1025` の search secret baseline 実装と validation が完了
- Next: commit / push / PR 作成と Linear の `In Review` 更新を行う

## Decisions
- low-budget path では検索基盤の初期前提を `Elastic Cloud` に寄せる
- runtime wiring より先に Secret Manager inventory を固定する
- index name は runtime contract (`messages`) に固定し、Secret Manager へ逃がさない

## How to run / demo
- `enable_minimal_search_secret_baseline = true` を設定する
- Terraform `plan/apply` 後に search secret version を追加する
- outputs と `gcloud secrets describe` / `gcloud secrets versions list` で inventory を確認する

## Known issues / follow-ups
- runtime env wiring と connectivity smoke test はこの issue の対象外
- standard path の `LIN-975` で hosting comparison と lifecycle / network を続ける

## Validation log
- `terraform fmt -check -recursive infra`
- `PATH=/tmp/terraform_1.6.6:$PATH make infra-validate`
- `make validate`
- `git diff --check`

## Review notes
- infra / docs 変更のみで UI 変更なし
- Elastic Cloud deployment 自体は含めず Secret Manager inventory に限定
- `make validate` は最初の実行で既存 TypeScript テスト timeout に遭遇したが、対象 2 本の再実行は pass、full rerun でも pass
