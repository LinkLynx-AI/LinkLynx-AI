# Implement.md (Work log)

## Notes
- Start from `codex/lin-913-invite-auth-return-flow`.
- Base branch is the stacked `codex/lin-912-invite-join-idempotent`.
- Keep `returnTo` semantics unchanged; use invite-specific resume state instead of widening protected-route normalization.
- Added invite-specific query handling on `/login` and `/verify-email` via `invite=...`.
- Added a client wrapper for `/invite/[code]` that swaps CTA by auth state and auto-joins on `?autoJoin=1`.
- Added frontend invite join API parsing on top of `authenticatedFetch`.
