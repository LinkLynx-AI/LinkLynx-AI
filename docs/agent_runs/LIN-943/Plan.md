# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: if validation fails, repair it before moving to the next step.

## Milestones
### M1: API client / shared model を hierarchy-aware に更新
- Acceptance criteria:
  - [x] `GuildChannelAPIClient` が `type`, `parent_id`, `position` を正規化する
  - [x] create/update/delete cache path が category を壊さない
  - [x] API client tests が backend DTO を前提に通る
- Validation:
  - `cd typescript && npm run typecheck`
  - `cd typescript && npm run test -- src/shared/api/guild-channel-api-client.test.ts`

### M2: sidebar / modal / route fallback を category-aware 化
- Acceptance criteria:
  - [x] sidebar が category row を非遷移で描画し、top-level channel と child channel を分離表示する
  - [x] server context menu と channel context menu から category 作成 / 配下作成を出し分けられる
  - [x] delete fallback と server page redirect が category を遷移先に選ばない
- Validation:
  - `cd typescript && npm run test -- src/features/modals/ui/create-channel-modal.test.tsx src/features/modals/ui/channel-delete-modal.test.tsx src/app/channels/[serverId]/page.test.ts`

### M3: 統合確認と delivery evidence
- Acceptance criteria:
  - [x] `make validate` が通る
  - [x] reviewer / UI gate / runtime smoke の準備ができている
  - [x] PR 用 evidence を Documentation.md に残す
- Validation:
  - `make validate`
  - `cd typescript && npm run typecheck`
