# Documentation.md (Status / audit log)

## Current status
- Now: `LIN-1022` の Dragonfly low-budget baseline 実装と validation が完了
- Next: commit / push / PR 作成と Linear の `In Review` 更新を行う

## Decisions
- low-budget path の Dragonfly は `StatefulSet` ではなく `Deployment` で始める
- restart 時の state loss は許容し、ADR-005 と session fallback で吸収する

## How to run / demo
- `enable_minimal_dragonfly_baseline = true` と `minimal_dragonfly_image` を設定する
- `workflow_dispatch` か local Terraform で `prod` plan/apply を実行する
- endpoint は `dragonfly.dragonfly.svc.cluster.local:6379`

## Known issues / follow-ups
- application runtime の Dragonfly client wiring はこの issue の対象外
- persistence / replication / isolated stateful placement は標準 path の `LIN-969` に残す

## Validation log
- `terraform fmt -check -recursive infra`
- `PATH=/tmp/terraform_1.6.6:$PATH make infra-validate`
- `make validate`
- `git diff --check`

## Review notes
- infra / docs 変更のみで UI 変更なし
- Dragonfly runtime client wiring は含めず、low-budget infra baseline に限定
- 目視確認では blocking finding なし
