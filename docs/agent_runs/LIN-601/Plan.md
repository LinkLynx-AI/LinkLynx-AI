# LIN-601 Plan

## Milestones
1. Add LIN-601 Redpanda event-stream baseline contract under `database/contracts/`.
2. Add Redpanda topic/retention/replay operations runbook under `docs/runbooks/`.
3. Link LIN-601 contract and runbook from runtime/database index documents.
4. Record implementation decisions and validation outcomes under `docs/agent_runs/LIN-601/`.

## Validation commands
- make validate
- make rust-lint

## Acceptance checks
- Functional: topic naming, retention, replay flow are unambiguous.
- Performance: throughput/lag evaluation viewpoints are explicitly listed.
- Outage handling: broker outage behavior and recovery boundaries are explicit.
- Operations: topic add/change and replay execution procedure is documented end to end.
