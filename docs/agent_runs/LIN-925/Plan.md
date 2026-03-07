# LIN-925 Plan

## Rules
- Stop-and-fix: validation failure は先に修正する。
- `LIN-926` の UI 適用は混ぜない。

## Milestones
### M1: 契約を固定する
- Acceptance criteria:
  - [ ] snapshot 対象操作を最小集合に絞る
  - [ ] response shape と unavailable 方針を文書化する
- Validation:
  - docs diff review

### M2: backend snapshot endpoint を追加する
- Acceptance criteria:
  - [ ] protected route が追加されている
  - [ ] deny は `false`、unavailable は `503` の方針を実装している
  - [ ] guild / optional channel scope を返せる
- Validation:
  - `make rust-lint`

### M3: frontend client/hook を追加する
- Acceptance criteria:
  - [ ] APIClient 型が snapshot を表現できる
  - [ ] query hook が追加されている
  - [ ] `LIN-926` から使える public API がある
- Validation:
  - `cd typescript && npm run typecheck`
  - `make validate`
