# Runbooks Directory Guide

`docs/runbooks/` stores operational procedures used for execution, verification, and rollback.

- `search-reindex-runbook.md`: Search reindex operational flow (pre-check, start, execute, verify, and close) for the v0 baseline.
- `edge-rest-ws-routing-drain-runbook.md`: Edge REST/WS routing contract, health checks, rolling WS drain policy, and rollback procedure baseline.
- `auth-firebase-principal-operations-runbook.md`: Firebase Auth and `uid -> principal_id` operations baseline (REST/WS error policy, logs/metrics, and outage triage).
- `authz-noop-allow-all-spicedb-handoff-runbook.md`: Temporary `noop allow-all` exception expiry control and SpiceDB cutover/rollback handoff baseline.
- `session-resume-dragonfly-operations-runbook.md`: Session/resume/TTL continuity baseline on Dragonfly, including degraded behavior and TTL rollout/rollback procedure.
- `scylla-node-loss-backup-runbook.md`: Scylla node-loss continuity decisions and minimum backup/restore execution baseline for v0.
- `gcs-signed-url-retention-operations-runbook.md`: GCS attachment signed URL issuance/reissue flow, accidental deletion recovery, and retention policy change baseline.
- `redpanda-topic-retention-replay-runbook.md`: Redpanda topic naming/retention change controls, replay execution, outage recovery, and rollback baseline for v1 event stream operations.
