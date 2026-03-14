# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: validation や review で失敗したら次へ進まず修正する。

## Milestones
### M1: parent integration branch を作成して LIN-944 差分を載せる
- Acceptance criteria:
  - [x] `origin/main` ベースの branch を作成する
  - [x] `a76885f` を cherry-pick して LIN-944 差分のみを載せる
- Validation:
  - `git show --stat 4323f02`

### M2: review / validation evidence を揃える
- Acceptance criteria:
  - [x] run memory を追加する
  - [x] review gate を実行する
  - [x] `make validate`
  - [x] `make rust-lint`
  - [x] `cd typescript && npm run typecheck`
- Validation:
  - `make validate`
  - `make rust-lint`
  - `cd typescript && npm run typecheck`

### M3: main 向け PR を作成する
- Acceptance criteria:
  - [ ] PR title / body を日本語で作成する
  - [ ] `main` base なので human review required 状態で止める
  - [ ] Linear / run memory の最終状態を更新する
- Validation:
  - `gh pr view <number>`
