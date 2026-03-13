# Documentation.md (Status / audit log)

## Current status
- Implemented `LIN-930` scoped read wiring for guild members, guild roles, and shared-user profile.
- Validation completed except for repo-wide Python formatting setup in `make validate`.

## Decisions
- Scope is limited to `LIN-930` under `LIN-898`.
- Backend adds minimal read endpoints instead of shrinking frontend UI.
- other-user profile media is out of scope; response is text-first and frontend tolerates `null` media.

## How to run / demo
- Backend endpoints:
- `GET /v1/guilds/{guild_id}/members`
- `GET /v1/guilds/{guild_id}/roles`
- `GET /v1/users/{user_id}/profile`
- Frontend uses existing `useMembers`, `useRoles`, and `useUserProfile` hooks; major `v1` surfaces now read backend data instead of local mocks.

## Validation
- Passed: `cargo test get_guild_members_returns_directory_entries --manifest-path rust/Cargo.toml`
- Passed: `cargo test get_guild_roles_returns_directory_entries --manifest-path rust/Cargo.toml`
- Passed: `cargo test get_user_profile_returns_profile_for_shared_guild_user --manifest-path rust/Cargo.toml`
- Passed: `cd typescript && npm run test -- --run src/shared/api/guild-channel-api-client.test.ts src/widgets/member-list/ui/member-list.test.tsx src/features/user-profile/ui/profile-popout.test.tsx src/features/user-profile/ui/profile-modal.test.tsx`
- Passed: `cd typescript && npm run typecheck`
- Passed: `make rust-lint`
- Blocked: `make validate`
- Reason: Python environment could not resolve `black==24.10.0`, so the `py-format` stage failed before the full repo validation could complete.

## Known issues / follow-ups
- other-user avatar/banner signed URL support remains for a future issue.
- settings-only mock screens remain out of scope for this run.
- `make validate` needs Python formatter dependency resolution in the local environment before it can pass end-to-end.
