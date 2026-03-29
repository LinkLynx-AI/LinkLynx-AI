# Cloud SQL Postgres Migration Operations Runbook

- Status: Draft
- Last updated: 2026-03-29
- Owner scope: Cloud SQL / PostgreSQL schema operations
- References:
  - `database/contracts/lin588_postgres_operations_baseline.md`
  - `docs/DATABASE.md`
  - `docs/runbooks/postgres-pitr-runbook.md`
  - `LIN-1017`

## 1. Purpose and scope

This runbook defines the forward-only migration baseline for the Cloud SQL-backed PostgreSQL production path.

In scope:

- Pre-check gates before applying production migrations
- Operator approval and execution flow
- Post-check and rollback boundaries

Out of scope:

- Application-side database client changes
- Cloud SQL Auth Proxy rollout details
- Backward-incompatible schema changes

## 2. Principles

- The source of truth remains `database/postgres/migrations`.
- Migrations are append-only. Editing existing migration files is prohibited.
- Production rollback is **application rollback + corrective forward migration** only.
- Restore or PITR is reserved for data-loss or consistency incidents, not normal schema rollback.

## 3. Environment policy

| Environment | Validation / apply rule |
| --- | --- |
| local | `docker compose` + `make db-migrate` for fast feedback |
| staging | Not provisioned in the low-budget path. Use local or temporary validation environment. |
| prod | Manual approval required before execution |

## 4. Pre-checks before prod migration

All of the following must be true:

1. Migration diff is reviewed and consistent with forward-only policy.
2. A recent automated backup exists.
3. PITR is enabled and the restore window covers the expected rollback decision point.
4. The operator running the migration has private reachability and approved credentials for Cloud SQL.
5. The deploy plan identifies application rollout order and failure owner.

## 5. Standard execution flow

1. Validate the migration locally against the repo baseline.
2. Confirm the target migration list and expected DDL impact.
3. Freeze unrelated deploys.
4. Take note of:
   - current application revision
   - Cloud SQL instance name
   - latest successful backup time
   - earliest / latest restore time
5. Obtain explicit manual approval for prod execution.
6. Execute the migration from an approved runner with Cloud SQL private reachability.
7. Run post-checks immediately after apply.

## 6. Post-checks

After apply, confirm:

1. Migration state is consistent (`sqlx migrate info` or equivalent).
2. Core metadata reads succeed.
3. Connection pressure stays within the LIN-588 thresholds.
4. Error rate and latency do not regress during the first observation window.

## 7. Failure handling

If migration apply fails:

1. Stop further rollout.
2. Roll back application traffic if needed.
3. Decide between:
   - corrective forward migration, or
   - PITR / restore procedure via `docs/runbooks/postgres-pitr-runbook.md`
4. Record failure reason, data impact, and next action in the incident log.

## 8. Low-budget path notes

- `LIN-1017` uses a single prod Cloud SQL instance and does not include HA or read replicas.
- Shared-core / small-instance profiles are bootstrap-only choices and should be upgraded before meaningful production traffic.
- A standard production profile should move to dedicated-core and revisit HA before release risk becomes material.
