# AuthZ SpiceDB Local/CI Runtime Foundation Runbook

- Status: Draft
- Last updated: 2026-03-07
- Owner scope: LIN-863 local/CI runtime baseline + LIN-865 fail-close integration + LIN-876 reproducibility hardening
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
- `SPICEDB_CHECK_ENDPOINT=http://localhost:8443` (or compose network endpoint)
- `SPICEDB_PRESHARED_KEY=<non-empty>`
- `SPICEDB_REQUEST_TIMEOUT_MS=1000`
- `SPICEDB_CHECK_MAX_RETRIES=1`
- `SPICEDB_CHECK_RETRY_BACKOFF_MS=100`
- `AUTHZ_CACHE_ALLOW_TTL_MS=5000`
- `AUTHZ_CACHE_DENY_TTL_MS=1000`
- `SPICEDB_POLICY_VERSION=lin862-v1`
- `SPICEDB_SCHEMA_PATH=database/contracts/lin862_spicedb_namespace_relation_permission_contract.md`
- `docker-compose.yml` の `spicedb` image は `authzed/spicedb:v1.49.2@sha256:b3ff822f5bd583d5a7e91753b6d2958f1ceb0c79113f5228c8e66f7a29e6da7d` を使用する

Misconfiguration behavior (current baseline):
- Runtime config or authorizer initialization errors are logged and provider moves to fail-close path (`AUTHZ_UNAVAILABLE`).
- Implicit fallback to `noop allow-all` is prohibited.

## 3. Local startup and health check

1. Start SpiceDB:

```bash
make authz-spicedb-up
```

2. Health check (gRPC/HTTP ports):

```bash
make authz-spicedb-health
```

3. Start API with SpiceDB env:

```bash
AUTHZ_PROVIDER=spicedb \
SPICEDB_ENDPOINT=http://localhost:50051 \
SPICEDB_CHECK_ENDPOINT=http://localhost:8443 \
SPICEDB_PRESHARED_KEY=replace-with-dev-spicedb-key \
make rust-dev
```

4. Confirm runtime log behavior:
- if config is valid: `AUTHZ_PROVIDER=spicedb runtime config is ready`
- if config is invalid: `AUTHZ_PROVIDER=spicedb runtime config is invalid; fail-close authorizer is active`
- if authorizer initialization fails: `failed to initialize spicedb authorizer; fail-close authorizer is active`
5. Optional auth smoke verification (run in a separate terminal while API is still running):

```bash
cd typescript && npm run smoke:auth -- --mode=happy-path
```

Prerequisites:
- `typescript/.env.local` is populated per `docs/runbooks/auth-firebase-principal-operations-runbook.md`
- `AUTH_SMOKE_EMAIL` and `AUTH_SMOKE_PASSWORD` point to a verified Firebase test user

Expected:
- Firebase login succeeds.
- `GET /protected/ping` returns `200`.
- `/ws + auth.identify` reaches `auth.ready`.

## 4. CI baseline

CI baseline job must:
1. `docker compose up -d spicedb`
2. verify `localhost:50051` and `localhost:8443` are reachable
3. verify `/v1/permissions/check` minimum contract:
   - missing auth header: `401` + unauthenticated error body
   - auth header present: valid response body containing `permissionship`
4. print SpiceDB logs and fail when endpoint does not become ready
5. always stop containers at job end

## 5. Image pin update procedure

SpiceDB version update must always update both tag and digest together.

1. Pull candidate version:

```bash
docker pull authzed/spicedb:vX.Y.Z
```

2. Resolve digest and confirm version output:

```bash
docker image inspect authzed/spicedb:vX.Y.Z --format '{{index .RepoDigests 0}}'
docker run --rm authzed/spicedb:vX.Y.Z version
```

3. Update `docker-compose.yml` with `authzed/spicedb:vX.Y.Z@sha256:<digest>`.
4. Run reproducibility checks:
   - `make authz-spicedb-up`
   - `make authz-spicedb-health`
   - run CI-equivalent contract checks for `/v1/permissions/check` (401 without auth, 200+permissionship with auth)
5. Record update rationale and validation results in child issue/PR.

## 6. Troubleshooting

### 6.1 SpiceDB port is not reachable
- Confirm compose service is running:
  - `docker compose ps spicedb`
- Confirm logs:
  - `docker compose logs spicedb`

### 6.2 Runtime misconfigured log appears
- Ensure `SPICEDB_PRESHARED_KEY` is non-empty
- Ensure `SPICEDB_ENDPOINT` is a valid URL (e.g. `http://localhost:50051`)
- Ensure `SPICEDB_CHECK_ENDPOINT` is a valid URL (e.g. `http://localhost:8443`)
- Ensure `SPICEDB_REQUEST_TIMEOUT_MS` is valid `u64`
- Ensure `SPICEDB_CHECK_MAX_RETRIES` is valid `u32`
- Ensure `SPICEDB_CHECK_RETRY_BACKOFF_MS` is valid `u64`

### 6.3 Fail-close behavior check
- Stop SpiceDB and call one protected endpoint.
- Expected:
  - REST returns `503` with `AUTHZ_UNAVAILABLE`
  - WS closes with `1011`
- If request is accepted, treat as contract violation and rollback latest authz runtime changes.

Recommended end-to-end verification:

1. Keep API running with `AUTHZ_PROVIDER=spicedb`.
2. Stop SpiceDB:
   - `make authz-spicedb-down`
3. Run:
   - `cd typescript && npm run smoke:auth -- --mode=dependency-unavailable`
4. Expected smoke output:
   - `protected/ping` fails with `503 / AUTHZ_UNAVAILABLE`
   - `/ws + auth.identify` closes with `1011 / AUTHZ_UNAVAILABLE`
   - command requires the same `typescript/.env.local` prerequisites as the happy-path smoke
5. Restart SpiceDB and health check:
   - `make authz-spicedb-up`
   - `make authz-spicedb-health`

## 7. Exit criteria for LIN-863 + LIN-876

All items must be true:
- Local startup and health check are reproducible with documented commands.
- CI job can start SpiceDB, validate endpoint readiness, and verify `/v1/permissions/check` minimum contract.
- SpiceDB image is pinned by tag + digest and pin update steps are documented.
- Required env keys and misconfiguration behavior are documented.
