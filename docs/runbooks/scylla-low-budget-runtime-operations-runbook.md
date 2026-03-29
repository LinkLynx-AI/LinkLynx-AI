# Scylla Low-budget Runtime Operations Runbook

- Owner scope: low-budget `prod-only` Scylla runtime baseline
- Related:
  - `database/contracts/lin589_scylla_sor_partition_baseline.md`
  - `docs/runbooks/scylla-node-loss-backup-runbook.md`
  - `docs/runbooks/terraform-low-budget-prod-deploy-runbook.md`
  - `LIN-1023`

## 1. Purpose

This runbook defines the low-budget `prod-only` runtime baseline for wiring external Scylla into the `rust-api-smoke` workload.

This baseline only covers:

- image artifact readiness
- runtime `SCYLLA_*` env injection
- verify / rollback flow

This baseline does **not** cover:

- Scylla cluster provisioning
- VPC peering or private networking setup
- backup or restore automation
- auth / TLS expansion beyond the current runtime contract

Those remain in standard path `LIN-970`.

## 2. Baseline shape

- workload: `rust-api-smoke`
- env vars:
  - `SCYLLA_HOSTS`
  - `SCYLLA_KEYSPACE`
  - `SCYLLA_SCHEMA_PATH`
  - `SCYLLA_REQUEST_TIMEOUT_MS`
- schema artifact path in image:
  - `/app/database/scylla/001_lin139_messages.cql`
- health endpoint:
  - `/internal/scylla/health`

## 3. Enable procedure

In `infra/environments/prod` set:

```hcl
enable_rust_api_smoke_deploy           = true
enable_minimal_scylla_runtime_baseline = true
minimal_scylla_hosts                   = ["10.80.0.10:9042"]
minimal_scylla_keyspace                = "chat"
minimal_scylla_schema_path             = "/app/database/scylla/001_lin139_messages.cql"
minimal_scylla_request_timeout_ms      = 1000
```

Then:

1. build and publish a Rust image that contains the bundled Scylla schema artifact
2. execute Terraform `plan`
3. confirm only the expected workload env diff is present
4. execute Terraform `apply`

Use the low-budget deploy flow in:

- `docs/runbooks/terraform-low-budget-prod-deploy-runbook.md`

## 4. Verification

After apply:

1. confirm the `rust-api-smoke` Deployment rolled successfully
2. confirm the Pod spec contains the four `SCYLLA_*` env vars
3. confirm the image contains `/app/database/scylla/001_lin139_messages.cql`
4. confirm `GET /internal/scylla/health` no longer reports `config_invalid`

Expected outcome:

- if network reachability is correct, health moves to `ready` or a dependency-specific degraded/error reason
- if reachability is not ready yet, the response should still reflect runtime config wiring instead of missing-schema or missing-env failure

## 5. Rollback

If the runtime baseline introduces instability:

1. set `enable_minimal_scylla_runtime_baseline = false`
2. run Terraform `plan`
3. confirm only the workload env diff is being removed
4. run Terraform `apply`

If the image artifact is the source of regression, roll back the Rust image digest as well.

## 6. Failure handling

- `config_invalid`:
  - confirm `SCYLLA_HOSTS` is present
  - confirm `SCYLLA_SCHEMA_PATH` matches the bundled image path
- `connect_failed` or `connect_timeout`:
  - treat as external dependency reachability problem
  - verify network path and Scylla endpoint ownership outside this issue scope
- `keyspace_missing` or `table_missing`:
  - verify the external Scylla environment has the expected schema applied

## 7. Boundary with standard path

This low-budget path intentionally stops at runtime wiring.

Move to standard `LIN-970` when one or more are true:

- Scylla cluster/account/network provisioning must be codified
- TLS or auth is required for the runtime path
- backup / recovery expectations must be productionized
- the team no longer wants manual dependency ownership outside Terraform
