# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: validation が落ちたら次へ進む前に直す。

## Milestones
### M1: managed messaging cloud ops runbook を追加する
- Acceptance criteria:
  - [x] Redpanda Cloud / Synadia Cloud の ownership boundary が記載される
  - [x] incident triage と monitoring seed が記載される
  - [x] `LIN-971` へ残す責務が明確である
- Validation:
  - `make validate`

### M2: decisions / README / handoff を更新する
- Acceptance criteria:
  - [x] low-budget path の managed messaging 運用境界が docs に反映される
  - [x] `LIN-1024` と `LIN-971` の分界が明確である
- Validation:
  - `git diff --check`
