# LIN-588 Postgres Operations Baseline (Forward-Only Migration / Pool Exhaustion Controls / PITR Requirements)

## Purpose

- Target issue: LIN-588
- Fix a single operational baseline for Postgres as the metadata source of record.
- Provide a stable prerequisite for LIN-597 (DR v0 runbook work).

In scope:

- Migration operation principles (forward-only)
- Connection pool exhaustion prevention, detection, mitigation, and recovery criteria
- Continuity policy during single-AZ outage
- PITR target values and runbook linkage

Out of scope:

- Application feature implementation
- DB schema changes
- Vendor-specific restore implementation details (for example Cloud SQL or Aurora)

## References

- `docs/DATABASE.md`
- `docs/runbooks/postgres-pitr-runbook.md`
- `docs/adr/ADR-002-class-ab-event-classification-and-delivery-boundary.md`
- `LIN-597` (DR v0)

## 1. Migration Operation (Forward-Only)

### 1.1 Source of truth

- The only source of truth for PostgreSQL schema changes is `database/postgres/migrations`.
- `database/postgres/schema.sql` is a derived snapshot.

### 1.2 Change principles

- Migrations must be append-only (new numbered files only).
- Editing existing migration files is prohibited.
- Production incident recovery must use corrective forward migrations.

### 1.3 Environment rules

| Environment | `make db-migrate` | `make db-migrate-revert` | Recovery policy |
| --- | --- | --- | --- |
| prod | Allowed | Prohibited | App rollback + corrective forward migration |
| staging | Allowed | Allowed for verification only | Prefer production-equivalent operation validation |
| dev | Allowed | Allowed for verification only | Verification/learning use only |

### 1.4 Standard procedure (Pre-check -> Apply -> Post-check)

1. Pre-check:
- Confirm target migrations.
- Review delta and impact scope (DDL and data conversion).
2. Apply:
- `make db-migrate`
3. Post-check:
- `make db-migrate-info`
- Optionally `make db-schema-check` when needed

## 2. Connection Pool Exhaustion Controls

### 2.1 Capacity budgeting formula

- `reserved_admin_connections = max(5, ceil(max_connections * 0.1))`
- `usable_connections = max_connections - reserved_admin_connections`
- `total_app_pool_max <= floor(usable_connections * 0.8)`

Rounding rules:

- `ceil`: round up
- `floor`: round down

### 2.2 Required monitoring metrics

- `pool_in_use_ratio`
- `pool_acquire_p95_ms`
- `pool_acquire_timeout_total`

### 2.3 Thresholds

- Warning:
  - `pool_in_use_ratio >= 0.80` for 5 consecutive minutes
  - or `pool_acquire_p95_ms >= 100` for 5 consecutive minutes
- Critical:
  - `pool_in_use_ratio >= 0.90` for 2 consecutive minutes
  - or detect `pool_acquire_timeout_total > 0` in a 1-minute window

### 2.4 Mitigation flow (priority order)

1. Apply write-path backpressure and suppress new heavy work.
2. Stop high-connection batch/admin jobs.
3. Re-tune app pool settings and reduce parallelism.
4. Record impact scope and temporary actions in incident logs.

### 2.5 Recovery criteria

Declare recovered only when all of the following hold for 10 consecutive minutes:

- `pool_in_use_ratio < 0.70`
- `pool_acquire_p95_ms < 50`
- `pool_acquire_timeout_total = 0`

## 3. Continuity Policy During Single-AZ Outage

### 3.1 Start condition

- Postgres remains unreachable or connection failures continue, and normal failover does not resolve the condition.

### 3.2 Continuity rules

- Treat Postgres-dependent, consistency-critical operations as `unavailable`.
- Continue only non-dependent paths that can safely proceed.
- Prohibit speculative writes that can break consistency (for example unverified success assumptions without compensation).

### 3.3 Recovery rules

1. Verify migration consistency (no divergence in applied state).
2. Verify baseline health (connectivity and core query response).
3. Restore traffic in stages: read-first, then write paths.

### 3.4 ADR alignment

- Use ADR-002 as the single source of truth for Class A/B outage behavior decisions.

## 4. PITR Requirements

- Temporary target: `RPO 15 minutes / RTO 1 hour`
- Source of truth for PITR procedure: `docs/runbooks/postgres-pitr-runbook.md`
- The runbook must include start conditions, close conditions, tabletop checklist, and drill record template.

## 5. Verification Points (Review Procedure)

1. Forward-only operation can be reproduced from documentation only.
2. Detection, mitigation, and recovery decisions are traceable at pool threshold crossings.
3. Single-AZ outage continuity boundaries are determinable without ambiguous wording.
4. PITR runbook explicitly includes start and close conditions.
