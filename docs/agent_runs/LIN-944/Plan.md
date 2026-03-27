# Plan.md

## Rules
- Stop-and-fix: validation failure は次の作業に進む前に修正する。

## Milestones
### M1: 回帰ケースの棚卸し
- Acceptance criteria:
  - [x] backend / frontend 既存テストでカバー済みのケースと未カバーのケースを整理する
  - [x] 追加する自動テストを最小差分に絞る

### M2: 不足回帰の追加
- Acceptance criteria:
  - [x] HTTP invalid parent 系の回帰を追加する
  - [x] sidebar の混在表示 / category 非遷移の回帰を追加する
  - [x] 検証手順を Documentation.md に追記する

### M3: 検証と delivery
- Acceptance criteria:
  - [x] `make validate`
  - [x] `make rust-lint`
  - [x] `cd typescript && npm run typecheck`
  - [x] PR 用 evidence を Documentation.md に残す
