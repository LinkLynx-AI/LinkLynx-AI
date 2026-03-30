# Plan

## Rules
- Stop-and-fix: typecheck/test failure は次工程へ進めない。
- Scope lock: LIN-953 は frontend settings 接続と fail-close UI に限定する。

## Milestones
### M1: 現行 mock 導線と API/permission snapshot 契約を整理する
- Acceptance criteria:
  - [x] 対象 slice と差し替え箇所が特定できている
  - [x] RouteGuard / permission snapshot の再利用方針が明確
- Validation:
  - `cd typescript && npm run typecheck`
  - Result: pass

### M2: roles/members/channel permissions を実 API へ接続する
- Acceptance criteria:
  - [x] roles/members 導線で CRUD/assignment が実データで動く
  - [x] channel permission editor で tri-state 読み書きが一致する
- Validation:
  - `cd typescript && npx vitest run src/shared/api/guild-channel-api-client.test.ts src/shared/api/mutations/use-role-actions.test.ts src/features/settings/ui/server/server-members.test.tsx src/features/modals/ui/channel-edit-permissions.test.tsx`
  - Result: pass

### M3: fail-close UI とテストを固定する
- Acceptance criteria:
  - [x] 禁止/依存障害時の disabled または guard が contract どおり
  - [x] relevant tests と typecheck/validate が通る
- Validation:
  - `make validate`
  - Result: pass
