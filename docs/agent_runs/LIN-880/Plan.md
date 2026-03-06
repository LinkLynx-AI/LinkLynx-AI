# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: validation が落ちたら次に進む前に修正する。

## Milestones
### M1: Backend guild delete API
- Acceptance criteria:
  - [x] `DELETE /guilds/{guild_id}` を追加する。
  - [x] owner / manage 権限境界と fail-close mapping を維持する。
  - [x] service / SQL / route tests を追加する。
- Validation:
  - `cargo test --manifest-path rust/Cargo.toml -p linklynx_backend delete_guild_`
  - `cargo test --manifest-path rust/Cargo.toml -p linklynx_backend guild_channel::tests`

### M2: Frontend delete flow
- Acceptance criteria:
  - [x] API client `deleteServer` を実装する。
  - [x] server settings に danger zone と確認ダイアログを追加する。
  - [x] 削除後の cache cleanup と fallback routing を実装する。
- Validation:
  - `npm -C typescript run test -- src/shared/api/guild-channel-api-client.test.ts src/features/settings/ui/server/server-overview.test.tsx src/features/context-menus/ui/server-context-menu.test.tsx src/features/modals/ui/server-delete-modal.test.tsx`

### M3: Full checks and gates
- Acceptance criteria:
  - [x] `make validate` が通る。
  - [x] `make rust-lint` が通る。
  - [x] `cd typescript && npm run typecheck` が通る。
  - [x] reviewer / UI gate / runtime smoke の結果を Documentation に記録する。
- Validation:
  - `make validate`
  - `make rust-lint`
  - `npm -C typescript run typecheck`
