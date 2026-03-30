# Cloud SQL Postgres Standard Operations Runbook

- Status: Draft
- Last updated: 2026-03-29
- Owner scope: Cloud SQL / PostgreSQL schema operations for the standard `staging + prod` path
- References:
  - `database/contracts/lin588_postgres_operations_baseline.md`
  - `docs/DATABASE.md`
  - `docs/runbooks/postgres-pitr-runbook.md`
  - `LIN-968`

## 1. Purpose and scope

This runbook defines the Cloud SQL operational baseline for the standard path that keeps both `staging` and `prod` provisioned.

In scope:

- Standard Cloud SQL topology and environment policy
- Forward-only migration gate and approval boundary
- Post-check, rollback, and PITR handoff

Out of scope:

- Application-side SQL client implementation
- Cloud SQL Auth Proxy rollout mechanics
- Read-replica expansion beyond the baseline

## 2. Standard topology

| Environment | Tier | Availability | Backup / PITR | Read replica |
| --- | --- | --- | --- | --- |
| staging | `db-custom-4-16384` | `ZONAL` | enabled | none |
| prod | `db-custom-4-16384` | `REGIONAL` | enabled | none |

Notes:

- Both environments use private IP only.
- Both environments use automated backup and PITR.
- Prod starts with HA enabled and read replica disabled.

## 3. Migration policy

The migration source of truth remains `database/postgres/migrations`.

- Migrations are append-only.
- Editing an already-applied migration file is prohibited.
- Production rollback is **application rollback + corrective forward migration**.
- PITR is reserved for data-loss or consistency incidents that cannot be corrected in time.

## 4. Environment execution policy

| Environment | Validation / apply rule |
| --- | --- |
| local | `docker compose` + `make db-migrate` for fast feedback |
| staging | CI validation after merge, then staging apply from an approved runner |
| prod | Manual approval required before execution, then automated command from the approved runner |

Target flow:

1. CI validation
2. staging apply
3. staging smoke / observation
4. prod manual approval
5. prod apply

## 5. Pre-checks before prod migration

All of the following must be true:

1. Migration diff is reviewed and consistent with the forward-only policy.
2. CI validation succeeded on the exact migration set to be applied.
3. Staging apply completed and no blocking error was observed during the observation window.
4. A recent prod backup exists.
5. PITR remains enabled and the restore window covers the expected rollback decision point.
6. The operator or runner has private reachability to prod Cloud SQL.
7. The deploy plan identifies application rollout order and failure owner.

## 6. Standard execution flow

1. Validate locally against the repo baseline.
2. Confirm target migration list and expected DDL impact.
3. Let CI validation complete on the final merge candidate.
4. Apply the migration to staging.
5. Run staging post-checks.
6. Freeze unrelated prod deploys.
7. Record:
   - current application revision
   - staging / prod Cloud SQL instance names
   - latest successful prod backup time
   - earliest / latest prod restore time
8. Obtain explicit manual approval for prod execution.
9. Execute the prod migration from an approved runner.
10. Run prod post-checks immediately after apply.

## 7. Post-checks

After apply, confirm:

1. Migration applied-state is consistent (`sqlx migrate info` or equivalent).
2. Core metadata reads succeed in the target environment.
3. Connection pressure stays within the LIN-588 thresholds.
4. Error rate and latency do not regress during the first observation window.

## 8. Failure handling

If staging apply fails:

1. Stop promotion to prod.
2. Diagnose the migration or runner issue.
3. Re-run only after a reviewed fix is merged.

If prod apply fails:

1. Stop further rollout.
2. Roll back application traffic if needed.
3. Choose between:
   - corrective forward migration, or
   - PITR / restore via `docs/runbooks/postgres-pitr-runbook.md`
4. Record failure reason, data impact, and next action in the incident log.

## 9. Baseline limits

- `LIN-968` does not provision a prod read replica.
- Read replica introduction requires a follow-up issue with owner, alert, and lag-handling policy.
- Cloud SQL Auth Proxy and secret distribution are handled by separate infra / app issues.
