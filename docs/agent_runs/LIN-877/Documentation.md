# Documentation.md (Status / audit log)

## Current status
- M1: Complete
- M2: Complete
- M3: Complete

## Decisions
- Server name max length is fixed to 100 chars.
- Icon handling in this issue is API-only (no upload flow).
- FE reason display for name validation is implemented pre-submit.
- ServerOverview protects in-progress input from background refetch overwrite by gating sync with local dirty state.

## Implementation summary
- Backend:
  - Added `PATCH /guilds/{guild_id}` route and request parsing (`name`, `icon_key`) in `rust/apps/api/src/main/http_routes.rs`.
  - Added `GuildPatchInput` and `update_guild` boundary method in `rust/apps/api/src/guild_channel/service.rs`.
  - Implemented Postgres update with fail-close manage boundary (`owner` or `allow_manage=TRUE`) in `rust/apps/api/src/guild_channel/postgres.rs`.
  - Added/updated route + service tests in `rust/apps/api/src/main/tests.rs` and `rust/apps/api/src/guild_channel/tests.rs`.
- Frontend:
  - Added `UpdateGuildData` and wired `updateServer` PATCH client in `typescript/src/shared/api/guild-channel-api-client.ts`.
  - Added `useUpdateServer` mutation with immediate cache sync for `["servers"]` and `["server", id]` in `typescript/src/shared/api/mutations/use-server-actions.ts`.
  - Wired server settings modal context with selected server id in `typescript/src/features/context-menus/ui/server-context-menu.tsx`.
  - Connected `ServerOverview` to real update flow with validation, success/error UI, and dirty-state sync guard in `typescript/src/features/settings/ui/server/server-overview.tsx`.
  - Added tests in:
    - `typescript/src/shared/api/guild-channel-api-client.test.ts`
    - `typescript/src/features/context-menus/ui/server-context-menu.test.tsx`
    - `typescript/src/features/settings/ui/server/server-overview.test.tsx`

## How to run / demo
- API update request example:
  - `PATCH /guilds/2001`
  - body: `{"name":"New Guild Name"}` or `{"icon_key":"icons/new.png"}` or `{"icon_key":null}`
- UI flow:
  - Open server context menu -> `サーバー設定`
  - Change server name in `サーバー概要`
  - Click `変更を保存`
  - Observe immediate server rail/name sync and success message

## Validation evidence
- `cargo test --manifest-path rust/Cargo.toml -p linklynx_backend guild_channel::tests` : pass
- `cargo test --manifest-path rust/Cargo.toml -p linklynx_backend patch_guild_` : pass
- `npm -C typescript run test -- src/shared/api/guild-channel-api-client.test.ts src/features/context-menus/ui/server-context-menu.test.tsx src/features/settings/ui/server/server-overview.test.tsx` : pass
- `npm -C typescript run typecheck` : pass
- `make rust-lint` : pass
- `make validate` : pass

## Reviewer gate
- `reviewer_simple` executed.
- Findings:
  - F-001 (P2): local edit overwrite risk in ServerOverview -> fixed with dirty-sync guard + regression test.
  - F-002 (P3): missing `icon_key` route coverage -> fixed by adding PATCH icon update/clear/invalid-type tests.

## Known issues / follow-ups
- None.
