# LIN-587 Plan

## Milestones
1. Add LIN-587 runtime contract under `database/contracts/`.
2. Link LIN-587 contract from `database/contracts/lin139_runtime_contracts.md`.
3. Add session/resume operations runbook under `docs/runbooks/`.
4. Update documentation indexes (`docs/runbooks/README.md`, `docs/DATABASE.md`, `AGENTS.md`).
5. Record run memory and validation outcomes under `docs/agent_runs/LIN-587/`.

## Validation commands
- make validate

## Acceptance checks
- Session/resume/TTL/heartbeat behavior is documented with fixed numeric baseline.
- Resume success target and metrics viewpoints are explicitly listed.
- Dragonfly outage degraded behavior is unambiguous and ADR-005 consistent.
- TTL rollout procedure includes `staging -> canary -> full rollout` and rollback trigger.
