# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: validation が落ちたら次へ進む前に直す。

## Milestones
### M1: external dependency observability runbook を追加する
- Acceptance criteria:
  - [x] Scylla / Redpanda / NATS / Elastic Cloud の check source が記載される
  - [x] alert seed と triage handoff が記載される
  - [x] `LIN-972` へ残す責務が明確である
- Validation:
  - `make validate`

### M2: Cloud Monitoring baseline と README 群を更新する
- Acceptance criteria:
  - [x] Cloud Monitoring baseline と provider manual checks の handoff が docs に反映される
  - [x] `LIN-1018` と `LIN-972` の分界が明確である
- Validation:
  - `git diff --check`
