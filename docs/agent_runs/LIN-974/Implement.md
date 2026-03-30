# Implement.md (Runbook)

- Follow Plan.md as the single execution order. If order changes are needed, document the reason in Documentation.md and update it.
- Keep diffs small and do not mix in out-of-scope improvements.
- Run validation after each milestone and fix failures immediately before continuing.
- Continuously update Documentation.md with decisions, progress, demo steps, and known issues.

## LIN-974 execution notes

1. Keep the scope on standard-path operations only; low-budget sibling docs already exist.
2. Reuse the standard-path baselines from `LIN-968`〜`LIN-975` as the incident first-check sources.
3. Define capacity assumptions as planning envelopes, not product guarantees.
4. Keep the “optimize first, then scale” rule explicit.
5. Use readiness-based Chaos conditions instead of date-based scheduling.
