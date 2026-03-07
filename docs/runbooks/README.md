# Runbooks Directory Guide

`docs/runbooks/` stores operational procedures used for execution, verification, and rollback.

- `search-reindex-runbook.md`: Search reindex operational flow (pre-check, start, execute, verify, and close) for the v0 baseline.
- `edge-rest-ws-routing-drain-runbook.md`: Edge REST/WS routing contract, health checks, rolling WS drain policy, and rollback procedure baseline.
- `auth-firebase-principal-operations-runbook.md`: Firebase Auth and `uid -> principal_id` operations baseline (REST/WS error policy, logs/metrics, and outage triage).
- `authz-noop-allow-all-spicedb-handoff-runbook.md`: Temporary `noop allow-all` exception expiry control and SpiceDB cutover/rollback handoff baseline.
- `authz-spicedb-local-ci-runtime-runbook.md`: SpiceDB local/CI runtime baseline (env contract, docker startup, health check, and troubleshooting).
- `authz-spicedb-tuple-sync-operations-runbook.md`: Postgres -> SpiceDB tuple mapping/backfill/outbox delta-sync baseline and full-resync operational hook.
- `session-resume-dragonfly-operations-runbook.md`: Session/resume/TTL continuity baseline on Dragonfly, including degraded behavior and TTL rollout/rollback procedure.
- `dragonfly-ratelimit-operations-runbook.md`: Dragonfly-backed rate-limit degraded enter/exit, `429 + Retry-After`, and outage simulation baseline for minimal v1 abuse controls.
- `realtime-nats-core-subject-subscription-runbook.md`: NATS Core subject naming contract, Gateway/Fanout subscribe-unsubscribe lifecycle, reconnect baseline, and outage handling for v0 realtime delivery.
- `scylla-node-loss-backup-runbook.md`: Scylla node-loss continuity decisions and minimum backup/restore execution baseline for v0.
- `scylla-local-runtime-bootstrap-runbook.md`: Scylla local runtime env, schema bootstrap, health probe, and troubleshooting baseline for API development.
- `gcs-signed-url-retention-operations-runbook.md`: GCS attachment signed URL issuance/reissue flow, accidental deletion recovery, and retention policy change baseline.
- `redpanda-topic-retention-replay-runbook.md`: Redpanda topic naming/retention change controls, replay execution, outage recovery, and rollback baseline for v1 event stream operations.
