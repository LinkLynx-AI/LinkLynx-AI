# Prompt.md (Spec / Source of truth)

## Goals
- Add avatar/banner file size guidance in the profile settings UI.
- Reject oversized avatar/banner selections before crop, upload, or patch runs.

## Non-goals
- No backend, DB, or upload contract changes.
- No image compression or optimization pipeline changes.

## Deliverables
- Size hint text for avatar and banner inputs.
- Frontend validation helper for avatar/banner file size limits.
- Regression tests for valid selection flow and oversized-file rejection.

## Done when
- [ ] UI shows avatar/banner size limits.
- [ ] Oversized files are blocked before crop/upload/save.
- [ ] Existing valid crop/preview/save flow remains intact.

## Constraints
- Build on top of `LIN-909` branch state.
- Keep scope to `LIN-959` only.
