# Documentation.md (Status / audit log)

## Current status
- Now: LIN-886 implementation, validation, and PR preparation completed.
- Next: create PR to `main` and hand off for human review.

## Decisions
- Scope follows LIN-886 only: persist `banner_key`, reuse Firebase Storage, and reflect saved profile media in settings + user panel.
- `banner_key` is added as an additive profile contract field; no existing profile fields are removed or repurposed.
- Frontend keeps pending local preview state separate from persisted storage keys so refetch does not overwrite unsaved edits.
- Save order is `avatar/banner upload -> profile PATCH`; uploaded objects from a failed save attempt are cleaned up best-effort.
- `ProfileBridge` hydrates saved `displayName`, `statusText`, and `avatarKey` back into auth-store after reload/relogin.
- Cropped image persistence uses the actual cropped `File`, not the original upload, so preview and saved result stay aligned.

## Validation
- `cargo test -p linklynx_backend banner_key` passed.
- `npm -C typescript run typecheck` passed.
- `npm -C typescript run test -- src/features/settings/ui/user/user-profile.test.tsx src/app/providers/profile-bridge.test.tsx src/shared/api/guild-channel-api-client.test.ts` passed.
- `npm -C typescript run test -- src/shared/ui/image-crop-modal.test.tsx src/features/settings/ui/user/user-profile.test.tsx src/app/providers/profile-bridge.test.tsx src/shared/api/guild-channel-api-client.test.ts` passed after the crop fix.
- `make validate` passed with escalation after sandbox-local-bind restrictions blocked the unprivileged run.

## Review
- `reviewer`: no blocking findings.
- `reviewer_ui_guard`: UI changes detected, so UI review was required.
- First `reviewer_ui` run found one blocking issue: cropped preview and uploaded file diverged because the modal returned the original image. This was fixed by rendering the crop to canvas and returning the cropped `File`.
- Re-running the UI reviewer after the fix was unstable at the tooling layer, so final confidence comes from the targeted TS tests above plus the passing `make validate`.

## Runtime smoke
- `make dev` did not complete in this worktree because `pnpm install --frozen-lockfile` hit an `ENOTEMPTY` collision in existing `node_modules`.
- Existing frontend dev server for this worktree on `http://localhost:3000` served `/login` and redirected `/channels/me` to `/login` without Playwright console errors.
- Existing backend on `http://localhost:8080` was reachable but belongs to another worktree (`lin-880`), so no branch-pure backend runtime smoke was executed and no existing process was modified.

## Known issues / follow-ups
- `user-profile` / `profile-bridge` Vitest cases emit React `act(...)` warnings, but all tests pass and there are no unhandled exceptions after the null-guard fix.
