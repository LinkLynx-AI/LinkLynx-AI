# Documentation.md (Status / audit log)

## Current status
- Now: `LIN-1028` の external Scylla ops baseline 実装と validation が完了した
- Next: commit / push / PR 作成と Linear の `In Review` 更新を行う

## Decisions
- low-budget path では cluster onboarding より先に ownership / backup / incident boundary を docs で固定する
- message body SoR は引き続き Scylla にあり、quorum 不確実時は fail-close 判断を優先する
- auth / TLS / secret rotation の productionization は標準 path に残す

## How to run / demo
- 追加 runbook を参照して external Scylla の provider boundary と incident triage を確認する
- `LIN-1023` の runtime baseline と合わせて low-budget Scylla path の docs が揃うことを確認する

## Known issues / follow-ups
- actual provider onboarding と connectivity smoke は `LIN-970` に残す
- auth / TLS / private connectivity automation は follow-up issue に残す

## Validation log
- `make validate` pass
- `git diff --check` pass

## Review notes
- docs のみの変更で runtime / infra resource 差分はない
- low-budget path では external dependency ownership を前提にし、ops boundary のみを先に閉じる
