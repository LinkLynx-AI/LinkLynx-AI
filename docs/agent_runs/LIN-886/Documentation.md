# Documentation.md (Status / audit log)

## Current status
- Now: LIN-886 implementation, PR 作成後の runtime bug fix まで完了。
- Next: updated PR を user review に回す。

## Decisions
- Scope follows LIN-886 only: persist `banner_key`, reuse Firebase Storage, and reflect saved profile media in settings + user panel.
- `banner_key` is added as an additive profile contract field; no existing profile fields are removed or repurposed.
- Frontend keeps pending local preview state separate from persisted storage keys so refetch does not overwrite unsaved edits.
- Save order is `avatar/banner upload -> profile PATCH`; uploaded objects from a failed save attempt are cleaned up best-effort.
- `ProfileBridge` hydrates saved `displayName`, `statusText`, and `avatarKey` back into auth-store after reload/relogin.
- Cropped image persistence uses the actual cropped `File`, not the original upload, so preview and saved result stay aligned.
- Browser から Firebase Storage を直接叩くと localhost origin で CORS preflight failure が起きたため、storage access は same-origin Next route (`/api/storage/object`) 経由へ切り替えた。
- Storage route は Firebase ID token を `Authorization: Firebase <token>` に変換して Storage REST へ転送し、download URL 解決・upload・delete を代行する。
- 保存済み avatar/banner object が消えている場合でも設定画面を壊さないよう、`GET /api/storage/object` は missing object / missing download token を `url: null` へ正規化して返す。
- WS origin 拒否の直接原因は backend の local dev 既定 allowlist が `localhost:3000` 系に固定され、Next dev server が `3001` へ退避したケースを拾えていなかったことだった。
- `AUTHZ_PROVIDER=noop` と WS origin チェックは責務が別なので allow-all にはせず、local dev の既定/fallback/compose/env examples/runbook を `localhost` / `127.0.0.1` の `3000` と `3001` に揃えて解消した。

## Validation
- `cargo test -p linklynx_backend banner_key` passed.
- `npm -C typescript run typecheck` passed.
- `npm -C typescript run test -- src/features/settings/ui/user/user-profile.test.tsx src/app/providers/profile-bridge.test.tsx src/shared/api/guild-channel-api-client.test.ts` passed.
- `npm -C typescript run test -- src/shared/ui/image-crop-modal.test.tsx src/features/settings/ui/user/user-profile.test.tsx src/app/providers/profile-bridge.test.tsx src/shared/api/guild-channel-api-client.test.ts` passed after the crop fix.
- `npm -C typescript run test -- src/shared/lib/firebase/storage.test.ts src/app/api/storage/object/route.test.ts src/features/settings/ui/user/user-profile.test.tsx src/app/providers/profile-bridge.test.tsx` passed after the CORS fix.
- `npm -C typescript run test -- src/shared/lib/firebase/storage.test.ts src/app/api/storage/object/route.test.ts` passed after the missing-object 404 handling fix.
- `cargo test -p linklynx_backend ws_origin_allowlist` passed after the local dev WS origin fix.
- `make validate` passed with escalation after sandbox-local-bind restrictions blocked the unprivileged run.

## Review
- `reviewer`: no blocking findings.
- `reviewer_ui_guard`: UI changes detected, so UI review was required.
- First `reviewer_ui` run found one blocking issue: cropped preview and uploaded file diverged because the modal returned the original image. This was fixed by rendering the crop to canvas and returning the cropped `File`.
- Re-running the UI reviewer after the fix was unstable at the tooling layer, so final confidence comes from the targeted TS tests above plus the passing `make validate`.

## Runtime smoke
- `make dev` did not complete in this worktree because `pnpm install --frozen-lockfile` hit an `ENOTEMPTY` collision in existing `node_modules`.
- Later live check for `/api/storage/object` could not run because this worktree’s `http://localhost:3000` dev server was not active at that point.
- Existing backend on `http://localhost:8080` was reachable but belongs to another worktree (`lin-880`), so no branch-pure backend runtime smoke was executed and no existing process was modified.

## Known issues / follow-ups
- `user-profile` / `profile-bridge` Vitest cases emit React `act(...)` warnings, but all tests pass and there are no unhandled exceptions after the null-guard fix.
