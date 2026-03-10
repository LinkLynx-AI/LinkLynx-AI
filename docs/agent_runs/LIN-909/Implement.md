# Implement.md (Runbook)

- Follow `docs/agent_runs/LIN-909/Plan.md` as the single execution order.
- Keep diffs scoped to profile save reflection only; avoid unrelated settings refactors.
- Add `banner_key` as an additive contract from DB to frontend, then keep save success synchronized through existing query/auth state.
- Use the existing storage integration path for avatar / banner object upload and best-effort cleanup on failure.
- Record validation results and environment blockers in `Documentation.md`.
