# PostgreSQL PITR Runbook (Draft)

- Status: Draft
- Last updated: 2026-02-26
- Owner scope: Postgres operations (v0 baseline)
- References:
  - `database/contracts/lin588_postgres_operations_baseline.md`
  - `docs/DATABASE.md`
  - `LIN-588`
  - `LIN-597`

## 1. Purpose and scope

This runbook defines decision gates and execution steps to start Point-In-Time Recovery (PITR), validate restored state, and resume service during Postgres incidents.

In scope:

- PITR start decision
- Target recovery timestamp decision
- Standard restore, validation, and resume procedure
- Tabletop drill checklist and record template

Out of scope:

- Vendor-specific operation details
- Production auto-recovery implementation
- v1 advanced DR operations

## 2. Targets

- `RPO 15 minutes`
- `RTO 1 hour`

Definitions:

- RPO: maximum acceptable data-loss window
- RTO: maximum acceptable time from incident detection to service resumption

## 3. PITR start conditions

Treat PITR as a candidate action when all of the following are true:

1. Postgres remains unavailable, or normal failover does not restore service.
2. Normal write-path recovery cannot restore consistency in time.
3. Incident scope (environment, time range, affected critical features) is identified.

Do not start PITR when:

- The outage is transient and normal recovery can meet RTO.
- Restore-source integrity (backup/WAL and related artifacts) is not confirmed.

## 4. Start decision

Start PITR only when both are true:

1. Section 3 conditions are satisfied.
2. Recovery owner and decision owner are explicitly assigned.

After the decision, record start time, expected recovery time, and target timestamp in incident logs.

## 5. Execution procedure

### 5.1 Decide target timestamp

1. Identify incident onset and abnormal-write interval.
2. Select the point that preserves consistency with minimum loss.
3. Confirm the selected point is within the RPO target (15 minutes).

### 5.2 Execute restore

1. Stop write paths or switch to maintenance mode.
2. Prepare restore target instance.
3. Restore to target timestamp from validated backups/logs.
4. Run baseline health checks on restored instance.

### 5.3 Validate data and contract consistency

1. Verify migration applied-state consistency (no divergence).
2. Validate core table reads.
3. Validate connectivity for required critical queries.

### 5.4 Resume service

1. Resume read paths first.
2. Resume write paths gradually after read-path stability.
3. Keep enhanced monitoring and judge full recovery against RTO.

## 6. Close decision

Declare PITR complete only when all are true:

1. Core Postgres functions return healthy responses.
2. Migration consistency and baseline data consistency are verified.
3. Staged read/write recovery is complete.
4. Incident impact, loss range, and measured RPO/RTO are recorded.

## 7. Escalation conditions

Escalate immediately when any of the following is true:

- Expected loss exceeds `RPO 15 minutes`.
- Recovery within `RTO 1 hour` is unlikely.
- Restore-source data loss/corruption is suspected.
- Post-restore migration applied-state is inconsistent.

## 8. Tabletop drill checklist

1. Define outage scenario (single-AZ outage).
2. Execute start conditions and start decision from docs only.
3. Show objective rationale for target timestamp choice.
4. Verify close conditions can be judged objectively.
5. Record follow-up improvements in a format reusable by LIN-597.

## 9. Drill record template

```markdown
### Postgres PITR Drill Record

- Date:
- Environment:
- Scenario:
- Detected at:
- PITR start at:
- Target timestamp:
- Service resume at:
- RPO result:
- RTO result:
- Data loss summary:
- Validation summary:
- Open risks:
- Follow-up issues:
```
