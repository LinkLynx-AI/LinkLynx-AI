# Search Elastic Cloud Low-budget Operations Runbook

- Status: Draft
- Last updated: 2026-03-29
- Owner scope: low-budget `prod-only` Elastic Cloud snapshot / lifecycle baseline
- References:
  - [ADR-003 Search Consistency Model, Lag SLO, and Reindex Strategy](../adr/ADR-003-search-consistency-slo-reindex.md)
  - [Search Reindex Runbook (Draft)](./search-reindex-runbook.md)
  - [Search Low-budget Operations Runbook](./search-low-budget-operations-runbook.md)
  - [LIN-139 runtime contracts](../../database/contracts/lin139_runtime_contracts.md)

## 1. Purpose and scope

This runbook defines the low-budget `prod-only` operating baseline for `Elastic Cloud` after connection material has been reserved in Secret Manager.

In scope:

- Snapshot, restore, and retention baseline
- Lifecycle and change-management boundaries
- Incident triage and monitoring seed
- Responsibility split between Elastic and LinkLynx

Out of scope:

- Elastic Cloud deployment provisioning
- Runtime client wiring and search query smoke tests
- OpenSearch self-managed operations
- Full production operating model that belongs to `LIN-975`

## 2. Hosting baseline

- Low-budget path fixes `Elastic Cloud` as the hosted search service.
- The deployment-specific default repository `found-snapshots` and policy `cloud-snapshot-policy` stay enabled.
- Same-region restore is the default recovery path.
- Cross-region restore is out of scope for the low-budget path. If it becomes necessary, create a follow-up issue to introduce a custom repository.
- Snapshots cover only open indices. Closed indices are not recoverable from snapshots.

## 3. Responsibility split

| Area | Elastic Cloud | LinkLynx |
| --- | --- | --- |
| Control plane availability | owns | monitors status and opens incident |
| Underlying snapshot repository for default managed snapshots | owns | does not modify directly |
| `found-snapshots` default repository and `cloud-snapshot-policy` baseline | provides | must not disable or delete |
| Search index naming and application semantics | no | owns (`messages` index contract) |
| Snapshot frequency and retention review | partial | decides whether defaults are sufficient and raises follow-up work |
| Restore execution decision | no | owns |
| Reindex correctness after restore | no | owns via ADR-003 and reindex runbook |

## 4. Snapshot baseline

1. Keep the default `found-snapshots` repository registered.
2. Keep the default `cloud-snapshot-policy` enabled.
3. Before risky changes, take an on-demand snapshot from Kibana or the Elasticsearch API.
4. Do not copy or mutate repository contents outside supported snapshot APIs.
5. Do not treat VM or disk snapshots as a substitute for Elasticsearch snapshots.

Low-budget rule:

- If default snapshots are sufficient, do not add a custom repository yet.
- If business requirements need cross-region restore or independent retention, open a follow-up issue before changing repository topology.

## 5. Restore baseline

Preferred restore path:

1. Create or identify an incident or ops ticket.
2. Confirm the target deployment is in the same region as the snapshot source.
3. Confirm the `messages` index is the target recovery scope.
4. Restore into a separate deployment when possible, especially before replacing a still-readable production deployment.
5. Expect cluster health to be `yellow` while primaries recover; do not declare completion until shard recovery and query checks are stable.
6. After restore, run consistency verification against ADR-003 thresholds and the reindex runbook.

Do not:

- Disable the default snapshot policy to “freeze” the cluster.
- Edit the snapshot repository contents outside supported APIs.
- Assume a restored cluster is ready before search error rate and lag checks converge.

## 6. Lifecycle and change management baseline

- Index name stays `messages` per runtime contract.
- Any ILM, custom repository, retention-policy, or tiering change requires a dedicated issue.
- Default low-budget posture is to keep Elastic-managed defaults until observed scale or retention requirements force customization.
- Upgrades, major mapping changes, or region moves must include an on-demand snapshot checkpoint before execution.

## 7. Monitoring seed

Low-budget path should at minimum observe these signals:

- search latency
- indexing error count / rate
- cluster health
- shard availability
- storage utilization
- snapshot success / failure
- age of the latest successful snapshot
- repository integrity / SLM health when surfaced by Elastic Cloud

Suggested first alert seeds:

- no successful snapshot inside the expected snapshot window
- cluster health stays non-green beyond a short maintenance window
- storage utilization approaches capacity
- indexing error rate is persistently elevated

## 8. Incident triage baseline

Classify the incident before taking action.

1. Query-only degradation
- Search latency or error rate rises, but snapshots and cluster health remain healthy.
- Triage query load, shard pressure, and recent deploys first.

2. Index freshness degradation
- Search results are stale or partial.
- Check indexing error rate, lag SLO, and then apply ADR-003 / reindex runbook if needed.

3. Snapshot or restore risk
- Missing snapshots, failed snapshots, repository integrity alerts, or restore failure.
- Pause risky changes and inspect Elastic Cloud deployment health before attempting restore.

Escalate to a dedicated follow-up issue when:

- default snapshot policy no longer meets retention or restore needs
- cross-region restore becomes required
- custom repository or ILM tuning is needed

## 9. Handoff boundary to standard path

Keep the following in `LIN-975`:

- Full hosting decision record against OpenSearch self-managed
- Staging / prod connectivity smoke tests
- Network / traffic filtering / auth operating model
- Custom repository design, if needed
- Full observability implementation across search runtime and ingestion
