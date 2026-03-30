# PostgreSQL PITR Runbook

- Status: Draft
- Last updated: 2026-03-29
- Owner scope: Postgres / Cloud SQL operations (v0 baseline)
- References:
  - `database/contracts/lin588_postgres_operations_baseline.md`
  - `docs/DATABASE.md`
  - `docs/runbooks/cloud-sql-postgres-migration-operations-runbook.md`
  - `LIN-588`
  - `LIN-597`
  - `LIN-1017`

## 1. Purpose and scope

This runbook defines decision gates and execution steps to start Point-In-Time Recovery (PITR), validate restored state, and resume service during Postgres incidents.

In scope:

- PITR start decision
- Target recovery timestamp decision
- Cloud SQL restore / clone-from-earlier-point procedure baseline
- Standard restore, validation, and resume procedure
- Tabletop drill checklist and record template

Out of scope:

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

### 5.2 Prepare Cloud SQL restore

1. Stop write paths or switch to maintenance mode.
2. Record the source instance name, latest successful backup, and earliest / latest restore time.
3. Prepare a **new restore target instance**. Do not overwrite the source instance in-place.
4. Choose the target timestamp and instance naming convention before execution.

### 5.3 Execute restore

1. Create a restored clone from the selected point in time.
2. Wait for restore completion and baseline instance health.
3. Run validation against the restored instance before any traffic cutover.

### 5.4 Validate data and contract consistency

1. Verify migration applied-state consistency (no divergence).
2. Validate core table reads.
3. Validate connectivity for required critical queries.
4. Confirm the restored instance exposes the expected earliest / latest restore window after recovery.

### 5.5 Resume service

1. Resume read paths first.
2. Resume write paths gradually after read-path stability.
3. Keep enhanced monitoring and judge full recovery against RTO.
4. Keep the source instance isolated until the incident close decision is recorded.

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

## 9. Cloud SQL-specific notes

- `LIN-1017` low-budget baseline assumes a single prod instance with backup + PITR enabled and no HA.
- `LIN-968` standard baseline assumes `staging=ZONAL` and `prod=REGIONAL` with backup + PITR enabled.
- `LIN-968` standard baseline keeps prod read replica disabled until a dedicated follow-up issue adds lag / ownership / failover handling.
- PITR should restore into a separate instance, then cut over after validation.
- Schema rollback still follows the forward-only rule. PITR is reserved for data-loss or consistency incidents that corrective forward migration cannot address in time.

## 10. Drill record template

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
