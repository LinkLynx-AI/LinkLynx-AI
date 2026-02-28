# LIN-590 Documentation Log

## Status
- Completed documentation implementation for LIN-590 scoped baseline updates.
- Added new contract and runbook for GCS signed URL / naming / retention policy.
- Updated DB and runbook index documents to reference the new baseline.

## Decisions
- Scope is documentation-only (no runtime/API/DB schema changes).
- Fixed values use secure short TTL profile:
  - Upload signed URL TTL: 5 minutes
  - Download signed URL TTL: 5 minutes
  - Accidental deletion recovery window: 7 days
- GCS is fixed as attachment binary source of record.
- Event class/outage behavior remains governed by ADR-002.
- ADR-001 compatibility checklist is N/A for this issue because no event schema change is in scope.

## Implemented artifacts
- `database/contracts/lin590_gcs_signed_url_and_retention_baseline.md`
- `docs/runbooks/gcs-signed-url-retention-operations-runbook.md`
- `docs/DATABASE.md`
- `docs/runbooks/README.md`
- `docs/agent_runs/LIN-590/Prompt.md`
- `docs/agent_runs/LIN-590/Plan.md`
- `docs/agent_runs/LIN-590/Implement.md`
- `docs/agent_runs/LIN-590/Documentation.md`

## Acceptance traceability

| Acceptance area | Requirement | Evidence |
| --- | --- | --- |
| Functional | Signed URL policy, object naming convention, retention policy are documented | `database/contracts/lin590_gcs_signed_url_and_retention_baseline.md` |
| Performance | Signed URL issuance SLO/SLI viewpoints are defined | `database/contracts/lin590_gcs_signed_url_and_retention_baseline.md` section 5 |
| Failure handling | Expired URL reissue and accidental deletion recovery flow are defined | `docs/runbooks/gcs-signed-url-retention-operations-runbook.md` sections 4 and 5 |
| Operations | Retention policy change procedure is defined | `docs/runbooks/gcs-signed-url-retention-operations-runbook.md` section 6 |
| Dependency handover | DR handover points for LIN-597 are explicit | `docs/runbooks/gcs-signed-url-retention-operations-runbook.md` section 8 |

## Validation results
- `make validate`: failed in local environment due to missing TypeScript dependencies.
  - failure path: `make validate` -> `cd typescript && make format` -> `pnpm run format` -> `prettier . --write`
  - error: `sh: prettier: command not found`
  - context: `node_modules` missing (`Local package.json exists, but node_modules missing, did you mean to install?`)
  - assessment: failure is environment dependency setup related, not caused by LIN-590 document diff.

## Pending
- None.
