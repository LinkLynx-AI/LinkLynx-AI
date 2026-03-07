# Scylla Local Runtime and Bootstrap Runbook

- Status: Draft
- Last updated: 2026-03-07
- Owner scope: LIN-936 local runtime foundation
- References:
  - `database/scylla/001_lin139_messages.cql`
  - `docs/DATABASE.md`
  - `database/contracts/lin589_scylla_sor_partition_baseline.md`
  - `docs/runbooks/scylla-node-loss-backup-runbook.md`

## 1. Purpose and scope

This runbook defines the minimum reproducible local workflow for Scylla-backed message runtime foundation.

In scope:
- local compose startup for `scylladb`
- API runtime env contract for Scylla health
- explicit schema bootstrap command
- local health verification and basic troubleshooting

Out of scope:
- message append/list adapter behavior
- production backup/restore decisions
- multi-node cluster tuning

## 2. Runtime env contract

Use the following baseline for local API runtime:

- `SCYLLA_HOSTS=localhost:9042`
- `SCYLLA_KEYSPACE=chat`
- `SCYLLA_SCHEMA_PATH=database/scylla/001_lin139_messages.cql`
- `SCYLLA_REQUEST_TIMEOUT_MS=1000`

Docker Compose API container uses `scylladb:9042` internally while preserving the same keyspace/schema defaults.

Current behavior:
- invalid config or unreachable Scylla returns `status=error`
- reachable Scylla without required baseline schema returns `status=degraded`
- reachable Scylla with `chat.messages_by_channel` available returns `status=ready`
- public probe responses expose only coarse `reason` codes such as `keyspace_missing`, `table_missing`, `config_invalid`, `connect_timeout`, `query_timeout`, `connect_failed`, and `query_failed`

## 3. Local startup and bootstrap

1. Start local databases:

```bash
make db-up
```

2. Apply Scylla schema explicitly:

```bash
make scylla-bootstrap
```

Bootstrap behavior:
- reads the current Scylla `data_center` from `system.local`
- uses `SCYLLA_KEYSPACE` when set, otherwise defaults to `chat`
- rewrites the local replication factor to `1`
- validates the keyspace identifier and exits non-zero on bootstrap failure
- pipes the adjusted CQL into `cqlsh`

This keeps the repository contract file unchanged while making single-node local bootstrap reproducible.

## 4. Health verification

1. Start the API:

```bash
make rust-dev
```

2. Check baseline app health:

```bash
curl -i -sS http://127.0.0.1:8080/health
```

Expected result:
- `200 OK`
- body `OK`

3. Check Scylla detail health:

```bash
make scylla-health
```

Expected result:
- `200` + `{"service":"scylla","status":"ready"}` when schema is applied
- `200` + `status=degraded` and `reason=keyspace_missing|table_missing` when Scylla is reachable but schema is missing
- `503` + `status=error` and `reason=config_invalid|connect_timeout|query_timeout|connect_failed|query_failed` when config is invalid or Scylla is unavailable

## 5. Troubleshooting

### 5.1 Scylla does not start
- Confirm compose status:
  - `docker compose ps scylladb`
- Confirm logs:
  - `docker compose logs scylladb`

### 5.2 Bootstrap fails
- Ensure `cqlsh` can connect inside the container:
  - `docker compose exec -T scylladb cqlsh -e "SELECT release_version FROM system.local;"`
- Re-run:
  - `make scylla-bootstrap`

### 5.3 API reports `degraded`
- Confirm schema application ran successfully.
- If you override `SCYLLA_KEYSPACE`, run `SCYLLA_KEYSPACE=<keyspace> make scylla-bootstrap`.
- Verify required table:
  - `docker compose exec -T scylladb cqlsh -e "SELECT table_name FROM system_schema.tables WHERE keyspace_name = '<keyspace>';"`

### 5.4 API reports `error`
- Confirm `SCYLLA_HOSTS` points to the correct endpoint for the current runtime mode.
- For local binary execution use `localhost:9042`.
- For Docker Compose API execution use `scylladb:9042`.
