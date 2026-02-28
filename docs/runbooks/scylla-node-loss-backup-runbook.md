# Scylla Node Loss and Backup/Restore Runbook (Draft)

- Status: Draft
- Last updated: 2026-02-27
- Owner scope: Scylla operations baseline (v0)
- References:
  - `database/contracts/lin589_scylla_sor_partition_baseline.md`
  - `docs/DATABASE.md`
  - `docs/adr/ADR-002-class-ab-event-classification-and-delivery-boundary.md`
  - `LIN-589`
  - `LIN-597`

## 1. Purpose and scope

This runbook defines start/stop decision gates and minimum execution steps for Scylla node-loss continuity and backup/restore operations.

In scope:

- Node-loss start and close decisions
- Continuation vs fail-close decision gates
- Minimum backup procedure (snapshot + schema preservation)
- Minimum restore procedure and staged resume
- Tabletop checklist and drill record template

Out of scope:

- Vendor-managed automation details
- Multi-region DR architecture design
- CQL schema redesign or application implementation changes

## 2. Baseline assumptions

1. Production keyspace replication is configured so one-node loss can still keep quorum.
2. Message persistence path uses quorum-level consistency compatible with the LIN-589 baseline.
3. ADR-002 remains the SSOT for Class A/B outage and compensation behavior.
4. Message body dual-write to Postgres is prohibited.

## 3. Node-loss start conditions

Treat node-loss operation as active when all are true:

1. At least one Scylla node is confirmed unavailable (`DN`) beyond transient restart windows.
2. Message read/write path shows sustained degradation or elevated error rate.
3. Incident owner and decision owner are assigned.

Do not start emergency operations when:

- Node state is flapping and converges to healthy within the observation window.
- Observed failures are isolated to non-Scylla dependencies.

## 4. Continuation decision

### 4.1 Continue in degraded mode

Continue service when both are true:

1. Required quorum is still achievable after one-node loss.
2. No critical divergence signal exists for message persistence/history retrieval.

Actions:

1. Keep read and write paths active.
2. Apply temporary backpressure to reduce burst load.
3. Increase monitoring for latest-N latency and write timeout trends.

### 4.2 Switch to recovery-first mode (fail-close writes)

Switch when any is true:

1. Quorum cannot be maintained.
2. Cluster state is uncertain and consistency cannot be asserted.
3. Critical write errors persist beyond mitigation window.

Actions:

1. Fail-close write paths.
2. Keep only safe read paths where consistency expectations are satisfied.
3. Prioritize cluster recovery, then staged traffic resume.

## 5. Minimum backup procedure

### 5.1 Pre-check

1. Record incident/ticket link, operator, and execution start time.
2. Confirm target keyspace and table scope (`chat`).
3. Confirm available disk/storage capacity for snapshot artifacts.

### 5.2 Execute backup

1. Create snapshot on each healthy node.
2. Export keyspace/table schema snapshot.
3. Collect snapshot artifacts and schema artifacts to backup storage.
4. Record artifact manifest (node, path, timestamp, checksum if available).

Reference command pattern (adjust to environment):

```bash
nodetool snapshot --tag <tag> chat
cqlsh -e "DESCRIBE KEYSPACE chat" > chat_keyspace_<tag>.cql
```

### 5.3 Backup completion criteria

Declare backup complete only when all are true:

1. Snapshot artifacts from required nodes are present.
2. Schema snapshot is archived with the same backup tag.
3. Artifact manifest is recorded and reviewable.

## 6. Minimum restore procedure

### 6.1 Start conditions

Start restore only when:

1. Continuity mode cannot satisfy service objectives, or
2. Explicit restore decision is made by incident owner.

### 6.2 Execute restore

1. Prepare restore target cluster/node.
2. Apply keyspace/table schema snapshot.
3. Restore snapshot SSTable data to target.
4. Refresh and recover node/table state.
5. Run health and data validation checks.

### 6.3 Validation checklist

1. Target keyspace/table metadata is consistent with baseline schema.
2. Latest-N retrieval path succeeds with expected ordering semantics.
3. No critical read/write error bursts after restore.
4. Compensation re-fetch path (ADR-002 Class A expectation) is available.

### 6.4 Staged resume

1. Resume read paths first.
2. Resume write paths after read stability is confirmed.
3. Keep heightened monitoring until close criteria are satisfied.

## 7. Close conditions

Close node-loss operation only when all are true:

1. Cluster/node health is stable.
2. Required quorum is healthy.
3. Read and write paths are resumed according to staged plan.
4. Incident timeline, impact scope, and follow-up actions are recorded.

## 8. Tabletop checklist

1. Confirm start conditions can be judged without undocumented assumptions.
2. Verify continuation vs fail-close decision is deterministic.
3. Walk through backup and restore steps end-to-end from this runbook only.
4. Confirm close conditions are objective and measurable.
5. Record LIN-597 follow-up tasks if gaps are found.

## 9. Drill record template

```markdown
### Scylla Node-Loss Drill Record

- Date:
- Environment:
- Scenario:
- Detected at:
- Decision (continue/fail-close) at:
- Backup started at:
- Backup completed at:
- Restore started at:
- Restore completed at:
- Read resume at:
- Write resume at:
- Validation summary:
- Data-loss summary:
- Open risks:
- Follow-up issues (incl. LIN-597 linkage):
```
