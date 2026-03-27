# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: if validation fails, repair it before moving to the next step.

## Milestones
### M1: server/channel 管理 UI を実API対応範囲へ整列する
- Acceptance criteria:
  - [x] server settings は real API-backed タブだけを表示する。
  - [x] server overview は guild name update / delete のみを編集操作として残す。
  - [x] channel edit modal は overview / invites のみを表示する。
  - [x] invite 一覧取得エラーは typed helper 表示へ統一される。
- Validation:
  - `cd typescript && npm run test -- src/features/settings/ui/settings-layout.test.tsx src/features/settings/ui/server/server-overview.test.tsx src/features/settings/ui/server/server-invites.test.tsx src/features/modals/ui/channel-edit-invites.test.tsx`
  - `cd typescript && npm run typecheck`

### M2: auth smoke を full-discord-flow へ拡張する
- Acceptance criteria:
  - [x] `auth-e2e-smoke` に `full-discord-flow` が追加される。
  - [x] 新モードが guild create -> channel create -> message create -> moderation report create/resolve を検証する。
  - [x] runbook に新モードの手順と triage が追加される。
- Validation:
  - `cd typescript && npm run test -- scripts/auth-e2e-smoke.test.mjs`
  - `node --check typescript/scripts/auth-e2e-smoke.mjs`
  - `make validate`
  - `make rust-lint`
