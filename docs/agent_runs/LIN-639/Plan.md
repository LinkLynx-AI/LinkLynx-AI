# LIN-639 Plan

## Milestones
1. Add frontend env parser and startup fail-fast hook.
2. Add backend startup env validator with strict parsing.
3. Align root/language env examples and compose contract.
4. Update auth runbook for local reproducibility.
5. Run validation and reviewer gates; record evidence.

## Validation commands
- `cd typescript && npm run typecheck`
- `make validate`

## Acceptance checks
- Required env missing causes startup failure with explicit key name.
- Invalid configured env value causes startup failure.
- `docs/runbooks` steps are sufficient for local auth runtime bring-up.
- Frontend/backend env contract mismatch is resolved in tracked templates.
