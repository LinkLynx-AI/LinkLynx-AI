# Documentation.md (Status / audit log)

## Current status
- Now: `LIN-1029` の external dependency observability baseline 実装と validation が完了した
- Next: commit / push / PR 作成と Linear の `In Review` 更新を行う

## Decisions
- low-budget path では Cloud Monitoring を system of record for GCP resources とし、external dependency は manual check source で handoff する
- full provider metrics ingestion は low-budget path に持ち込まない
- repeated incidents が出る dependency は標準 path の observability issue へ昇格させる

## How to run / demo
- 追加 runbook を参照して dependency ごとの first check source と alert seed を確認する
- `cloud-monitoring-low-budget-operations-runbook.md` から external handoff が辿れることを確認する

## Known issues / follow-ups
- provider metrics export や dashboard automation は `LIN-972` に残す
- provider onboarding や auth / network / runtime wiring の本実装は各 provider issue に残す

## Validation log
- `make validate` pass
- `git diff --check` pass

## Review notes
- docs のみの変更で runtime / infra resource 差分はない
- low-budget path では responder が迷わず check source を辿れることを優先する
- 初回 `make validate` は既存の `protected-preview-gate.browser.test.tsx` で単発失敗したが、対象テストの単体再実行は pass、続く full rerun も pass した
