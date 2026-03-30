# Documentation

## Current status
- Status: completed
- Scope delivered:
  - `ServerRoles` / `ServerMembers` を実 API の role/member role assignment に接続した
  - `ChannelEditPermissions` を role/user override API と `channel:manage` guard に接続した
  - frontend client/query/mutation に role reorder、member role replace、channel permission replace を追加した

## Decisions
- `member` system role は frontend では `@everyone` alias として表示する。
- channel permissions modal は `RouteGuard` の `channel:manage` を source of truth にし、forbidden/unavailable では fail-close でガード画面を出す。
- `PermissionToggle` の cross-slice import は FSD 違反になるため、modal 側には tri-state toggle を局所化した。
- role metadata は backend 契約に合わせて `name` と `allowView/allowPost/allowManage` を primary editable fields に絞り、`color/hoist/mentionable` は read-only fallback 扱いにした。

## How to run / demo
- Validation:
  - `cd typescript && npm run typecheck`
  - `cd typescript && npx vitest run src/shared/api/guild-channel-api-client.test.ts src/shared/api/mutations/use-role-actions.test.ts src/features/settings/ui/server/server-members.test.tsx src/features/modals/ui/channel-edit-permissions.test.tsx`
  - `make validate`
- Manual demo:
  - server settings の `roles` で role 作成、編集、並び替え、member assignment を確認する。
  - server settings の `members` で member role assignment 保存を確認する。
  - channel edit modal の `permissions` で role/user override の allow/deny/inherit 保存を確認する。

## Known issues / follow-ups
- settings 画面全体の UX polish や richer member picker は今回の scope 外。
- end-to-end / local verification runbook の整理は `LIN-954` で扱う。
