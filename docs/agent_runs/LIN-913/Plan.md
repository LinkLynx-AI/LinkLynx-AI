# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: if validation fails, repair it before moving to the next step.

## Milestones
### M1: invite resume 契約を route/auth 側へ追加
- Acceptance criteria:
  - [x] login / verify-email が invite resume 情報を受け渡せる。
  - [x] `returnTo` の protected-only 制約を維持する。
- Validation:
  - `cd typescript && npm run test -- routes`

### M2: invite page の join / redirect 導線を実装
- Acceptance criteria:
  - [x] 未認証時は login へ invite resume 付きで遷移できる。
  - [x] 認証済み時は invite join を実行できる。
  - [x] join 成功後に対象サーバーへ遷移する。
- Validation:
  - `cd typescript && npm run test -- invite`

### M3: Delivery evidence
- Acceptance criteria:
  - [x] run memory を更新する。
  - [x] `make validate` と `cd typescript && npm run typecheck` を通す。
  - [ ] PR evidence を作る。
- Validation:
  - `cd typescript && npm run typecheck`
  - `make validate`
