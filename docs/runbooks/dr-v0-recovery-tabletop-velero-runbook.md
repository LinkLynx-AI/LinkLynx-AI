# DR v0 Recovery Drill and Velero Verification Runbook

- Status: Draft
- Last updated: 2026-03-01
- Owner scope: DR v0 baseline
- References:
  - `docs/runbooks/postgres-pitr-runbook.md`
  - `docs/runbooks/scylla-node-loss-backup-runbook.md`
  - `docs/runbooks/search-reindex-runbook.md`
  - `docs/runbooks/gcs-signed-url-retention-operations-runbook.md`
  - `LIN-597`

## 1. Purpose and scope

This runbook fixes the v0 DR baseline across Postgres, Scylla, OpenSearch, and GCS.

In scope:

- Recovery start/stop gates and responsibility split
- Tabletop drill procedure for representative outage scenarios
- Velero restore verification plan (minimum: staging)
- Drill record and improvement tracking format

Out of scope:

- Full production auto-recovery implementation
- Multi-region active-active architecture
- v1 DR automation improvements

## 2. Baseline targets and assumptions

Temporary DR targets:

- Postgres: `RPO <= 15 minutes`, `RTO <= 1 hour`
- Other middleware: recoverability documented with explicit completion criteria

Assumptions:

1. Existing per-component runbooks are source procedures.
2. DR drill is tabletop-first in v0, with one staged restore verification.
3. Incident commander and component owners are assigned before drill execution.

## 3. Responsibility boundary

| Component | Primary owner | Recovery source runbook | Completion evidence |
| --- | --- | --- | --- |
| Postgres | DB owner | `postgres-pitr-runbook.md` | PITR point selection and recovery validation log |
| Scylla | Realtime/DB owner | `scylla-node-loss-backup-runbook.md` | node health + read/write recovery checklist |
| OpenSearch | Search owner | `search-reindex-runbook.md` | index health + reindex convergence record |
| GCS | Platform owner | `gcs-signed-url-retention-operations-runbook.md` | object restore/reissue verification |

## 4. DR activation gates

Start DR operation when all are true:

1. Service impact exceeds local mitigation threshold.
2. Component-specific recovery cannot be completed within normal incident window.
3. Incident commander explicitly declares DR mode.

Do not start DR mode when:

- impact is transient and mitigated within normal SLO window
- required recovery owners are unavailable

## 5. Tabletop drill procedure

## 5.1 Required scenarios

Run at least these scenarios:

1. Postgres recovery scenario (PITR decision)
2. Scylla node-loss with degraded continuity
3. OpenSearch outage with reindex recovery
4. GCS accidental deletion and object recovery

## 5.2 Drill steps

1. Record scenario assumptions and injected failure time.
2. Walk recovery decisions using linked component runbooks only.
3. Record start criteria, rollback criteria, and close criteria.
4. Capture blockers and missing data needed for real execution.

## 5.3 Drill completion criteria

Tabletop drill is complete only when:

1. Each scenario has unambiguous start/stop decisions.
2. Recovery owner and escalation owner are identified.
3. Evidence template fields are filled for every scenario.

## 6. Velero restore verification (staging minimum)

## 6.1 Preconditions

1. Staging cluster and backup artifacts are available.
2. Target namespace and restore scope are fixed.
3. Verification checklist owner is assigned.

## 6.2 Verification steps

1. Select backup snapshot and record version/time.
2. Execute Velero restore to staging target.
3. Validate resource restoration and service health.
4. Validate component-level post-restore checks.
5. Record duration, failures, and mitigations.

## 6.3 Success criteria

1. Restore command completes without blocking error.
2. Core services reach healthy state.
3. Post-restore verification checklist passes.
4. Evidence record is attached to DR run report.

## 7. Recovery close conditions

Close DR operation only when all are true:

1. Component recovery criteria are met and validated.
2. User-impacting behavior has returned to acceptable baseline.
3. Timeline, impact, and lessons learned are documented.
4. Follow-up issues are created for unresolved gaps.

## 8. Evidence template

```markdown
### DR v0 Drill/Recovery Record

- Date:
- Environment:
- Scenario:
- Incident commander:
- Component owner(s):
- DR start declared at:
- Recovery start at:
- Recovery complete at:
- RPO result:
- RTO result:
- Velero verification result:
- Remaining risks:
- Follow-up issue links:
```

## 9. Validation checklist

1. Four middleware recovery paths are all covered with ownership.
2. DR start/close gates are deterministic.
3. Velero staging verification is executable from this runbook.
4. Drill evidence template supports parent issue reporting.
