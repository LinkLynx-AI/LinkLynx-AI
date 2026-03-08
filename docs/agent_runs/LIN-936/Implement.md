# Implement.md (Runbook)

- Follow Plan.md as the single execution order. If order changes are needed, document the reason in Documentation.md and update it.
- Keep the diff limited to Scylla runtime foundation, health probe, bootstrap entry points, and related docs.
- Do not implement message adapter / usecase / API handlers in this run.
- Keep `GET /health` backward compatible and place Scylla detail health on a separate route.
- Run validation after each milestone and fix failures immediately before continuing.
- Continuously update Documentation.md with decisions, progress, demo steps, and known issues.
