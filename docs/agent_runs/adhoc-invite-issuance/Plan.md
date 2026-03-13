# Invite Issuance Plan

## Milestones
### M1: backend create contract を追加する
- Acceptance criteria:
  - [ ] create route と request/response shape が定義されている
  - [ ] service が guild/channel 整合と invite code 発行を行う
  - [ ] validation / unavailable のテストがある
- Validation:
  - `make rust-lint`

### M2: frontend create flow を接続する
- Acceptance criteria:
  - [ ] APIClient と mutation が create route を呼べる
  - [ ] create invite modal がフォーム送信と結果表示を行える
  - [ ] context menu / channel action から modal を開ける
- Validation:
  - `cd typescript && npm run typecheck`
  - targeted vitest

### M3: docs と検証結果を残す
- Acceptance criteria:
  - [ ] invite の現状説明が create 実装に更新されている
  - [ ] 実行コマンドと既知制約が `Documentation.md` に残っている
- Validation:
  - docs diff review
