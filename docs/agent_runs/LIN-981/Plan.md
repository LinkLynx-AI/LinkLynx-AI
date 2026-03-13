# Plan

## Rules
- Stop-and-fix: validation / review 失敗時は先へ進まない。
- Scope lock: message v1 runbook と traceability の更新に限定する。
- Start mode: child issue start (`LIN-981` under `LIN-976`)。

## Milestones
### M1: runbook の Draft 項目を tracked follow-up 化する
- Acceptance criteria:
  - [ ] follow-up owner / target date / entry condition が記載される
  - [ ] current v1 delivery gate からの除外が明記される
- Validation:
  - doc diff review

### M2: traceability へ追跡行を追加する
- Acceptance criteria:
  - [ ] `docs/V1_TRACEABILITY.md` から follow-up の所在が分かる
- Validation:
  - doc diff review

### M3: 最終確認と PR 化
- Acceptance criteria:
  - [ ] `make validate` が通る
  - [ ] `git diff --check` が通る
  - [ ] evidence が `Documentation.md` に残る
- Validation:
  - `make validate`
  - `git diff --check`
