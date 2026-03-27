# Plan

## Rules
- Stop-and-fix: validation failure を残したまま次工程へ進まない。
- Scope lock: LIN-954 は回帰試験とローカル検証手順に限定する。

## Milestones
### M1: 既存回帰の不足を埋める
- Acceptance criteria:
  - [x] unavailable / guard / role protection まわりの追加回帰が入っている
  - [x] 既存 LIN-952/LIN-953 の導線と重複せずに brittle edge を補完できている
- Result:
  - `useActionGuard` が `unavailable` を返すときの guard screen 表示を固定した。

### M2: ローカル検証手順を runbook に落とす
- Acceptance criteria:
  - [x] role 更新 -> tuple sync / invalidation -> permission snapshot / 実操作反映の手順が残っている
  - [x] failure triage と観察ポイントが追記されている
- Result:
  - local runtime runbook に propagation smoke を追加し、tuple sync runbook に失敗時の切り分け順を追記した。

### M3: 検証結果を固定する
- Acceptance criteria:
  - [x] relevant tests と `make validate` が通る
  - [x] Documentation.md に decisions と validation が残っている
- Result:
  - `cd typescript && npx vitest run src/features/modals/ui/channel-edit-permissions.test.tsx`
  - `make validate`
