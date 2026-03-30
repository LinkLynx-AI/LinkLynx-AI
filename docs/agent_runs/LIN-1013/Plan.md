# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: validation が落ちたら次へ進む前に修正する。
- `1 issue = 1 PR` を守り、staging smoke deploy 以外へ広げない。

## Milestones
### M1: Context review
- Acceptance criteria:
  - [x] `LIN-963`, `LIN-964`, `LIN-966` の staging 前提を確認する
  - [x] 再利用する module と不足している variables / checks を整理する
- Validation:
  - manual review

### M2: Terraform / docs implementation
- Acceptance criteria:
  - [x] staging root に smoke deploy variable / check / module invocation を追加する
  - [x] apply / verify / rollback runbook を追加する
  - [x] staging / infra README を同期する
- Validation:
  - `git diff --check`

### M3: Final validation and delivery
- Acceptance criteria:
  - [x] agent memory を更新する
  - [x] validation を通す
  - [x] PR / Linear 更新まで完了する
- Validation:
  - `terraform fmt -check -recursive infra`
  - `PATH=/tmp/terraform_1.6.6:$PATH make infra-validate`
  - `make validate`
