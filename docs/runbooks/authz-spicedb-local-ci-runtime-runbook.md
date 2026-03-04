# AuthZ SpiceDB Local/CI Runtime Foundation Runbook

- Status: Draft
- Last updated: 2026-03-04
- Owner scope: LIN-863 local/CI runtime baseline
- References:
  - `database/contracts/lin862_spicedb_namespace_relation_permission_contract.md`
  - `docs/AUTHZ_API_MATRIX.md`
  - `docs/adr/ADR-004-authz-fail-close-and-cache-strategy.md`
  - `docs/runbooks/authz-noop-allow-all-spicedb-handoff-runbook.md`

## 1. Purpose and scope

This runbook defines the minimum reproducible runtime foundation for SpiceDB in local development and CI.

In scope:
- docker-compose based SpiceDB startup
- runtime env contract for `AUTHZ_PROVIDER=spicedb`
- local/CI health checks and basic troubleshooting

Out of scope:
- production cutover and rollback decisions
- SpiceDB authorizer implementation details

## 2. Runtime env contract (local/CI)

When `AUTHZ_PROVIDER=spicedb`, use the following baseline:

- `AUTHZ_PROVIDER=spicedb`
- `AUTHZ_ALLOW_ALL_UNTIL=2026-06-30` (temporary exception tracking)
- `SPICEDB_ENDPOINT=http://localhost:50051` (or compose network endpoint)
- `SPICEDB_PRESHARED_KEY=<non-empty>`
- `SPICEDB_REQUEST_TIMEOUT_MS=1000`
- `SPICEDB_SCHEMA_PATH=database/contracts/lin862_spicedb_namespace_relation_permission_contract.md`

Misconfiguration behavior (current baseline):
- Runtime config errors are logged and provider falls back to noop allow-all path.
- This fallback is temporary and must be removed at LIN-865/LIN-868 completion.

## 3. Local startup and health check

1. Start SpiceDB:

```bash
make authz-spicedb-up
```

2. Health check (gRPC port):

```bash
make authz-spicedb-health
```

3. Start API with SpiceDB env:

```bash
AUTHZ_PROVIDER=spicedb \
SPICEDB_ENDPOINT=http://localhost:50051 \
SPICEDB_PRESHARED_KEY=replace-with-dev-spicedb-key \
make rust-dev
```

4. Confirm runtime log behavior:
- if config is valid: `spicedb runtime foundation is configured`
- if config is invalid: `spicedb runtime foundation is misconfigured`

## 4. CI baseline

CI baseline job must:
1. `docker compose up -d spicedb`
2. verify `localhost:50051` is reachable
3. print SpiceDB logs and fail when endpoint does not become ready
4. always stop containers at job end

## 5. Troubleshooting

### 5.1 SpiceDB port is not reachable
- Confirm compose service is running:
  - `docker compose ps spicedb`
- Confirm logs:
  - `docker compose logs spicedb`

### 5.2 Runtime misconfigured log appears
- Ensure `SPICEDB_PRESHARED_KEY` is non-empty
- Ensure `SPICEDB_ENDPOINT` is a valid URL (e.g. `http://localhost:50051`)
- Ensure `SPICEDB_REQUEST_TIMEOUT_MS` is valid `u64`

## 6. Exit criteria for LIN-863

All items must be true:
- Local startup and health check are reproducible with documented commands.
- CI job can start SpiceDB and validate endpoint readiness.
- Required env keys and misconfiguration behavior are documented.
