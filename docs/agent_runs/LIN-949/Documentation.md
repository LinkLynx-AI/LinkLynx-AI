# Documentation.md (Status / audit log)

## Current status
- Now: Validation completed successfully; preparing the merge commit for `codex/lin-949`.
- Next: Commit and push the repaired parent branch so PR #1264 can leave the conflicting state.

## Decisions
- Use the existing parent branch `codex/lin-949` as the repair target.
- Treat this run as conflict resolution only, not a new feature delivery.
- Keep ADR-004 fail-close and existing `*_v2`/SpiceDB contracts unchanged.
- Preserve the LIN-949 channel permissions tab and related route parsing while keeping `main` additions.
- Update the new `channel-edit-modal` test added on `main` so it matches the LIN-949 modal surface (`overview`, `permissions`, `invites`, `integrations`).

## How to run / demo
- `cd typescript && npm run test -- channel-edit-modal.test.tsx channel-edit-permissions.test.tsx`
- `cd typescript && npm run typecheck`
- `cd rust && cargo test -p linklynx_backend --no-run`
- `make validate`

## Validation results
- `cd typescript && npm run test -- channel-edit-modal.test.tsx channel-edit-permissions.test.tsx` ✅
- `cd typescript && npm run typecheck` ✅
- `cd rust && cargo test -p linklynx_backend --no-run` ✅
- `make validate` ✅

## Known issues / follow-ups
- PR #1264 was `CONFLICTING` against `main` at run start.
