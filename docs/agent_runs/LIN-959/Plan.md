# Plan.md (Milestones + validations)

## Milestones
### M1: Add size validation helper
- Add avatar/banner size constants and hint/error helpers in `features/settings/lib`.

### M2: Wire profile UI guard
- Show the size hints in profile settings.
- Block oversized file selection before crop/upload/save and show an inline error.

### M3: Validate and record evidence
- `cd typescript && pnpm test -- src/features/settings/ui/user/user-profile.test.tsx src/features/settings/lib/profile-image.test.ts`
- `cd typescript && pnpm typecheck`
- Run reviewer gates and create one PR for `LIN-959`.
