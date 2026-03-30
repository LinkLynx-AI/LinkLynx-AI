# Dragonfly Standard Operations Runbook

- Status: Draft
- Last updated: 2026-03-29
- Owner scope: standard path Dragonfly baseline on `staging` / `prod`
- References:
  - `docs/adr/ADR-005-dragonfly-ratelimit-failure-policy.md`
  - `database/contracts/lin587_session_resume_runtime_contract.md`
  - `docs/runbooks/session-resume-dragonfly-operations-runbook.md`
  - `docs/runbooks/dragonfly-ratelimit-operations-runbook.md`
  - `LIN-969`

## 1. Purpose and scope

This runbook defines the standard path Dragonfly baseline for `staging` / `prod` on GKE Autopilot.

In scope:

- Placement and isolation baseline
- Persistence and disruption policy
- Verify / rollback procedure
- Memory pressure and restart recovery notes

Out of scope:

- Application-side cache key design
- Dragonfly clustering or multi-primary topology
- Service mesh / egress control expansion

## 2. Baseline topology

| Item | Baseline |
| --- | --- |
| Namespace | `data` |
| Workload kind | `StatefulSet` |
| Replicas | `1` |
| Service | headless + `ClusterIP` |
| PVC | `20Gi` |
| PDB | `minAvailable=1` |
| Allowed client namespaces | `api` |

Internal endpoint:

- `dragonfly.data.svc.cluster.local:6379`

## 3. Isolation policy on Autopilot

Autopilot does not provide the same dedicated node-pool control surface assumed by a GKE Standard design.

For the standard baseline, translate the dedicated-pool requirement into:

1. dedicated namespace boundary (`data`)
2. single-purpose Dragonfly StatefulSet
3. ingress allowlist NetworkPolicy
4. preferred zone anti-affinity
5. PDB-controlled voluntary disruption boundary

This issue does **not** attempt hard node-level pinning.

## 4. Data boundary

Dragonfly remains a volatile operational store.

Allowed responsibility:

- session / resume state
- rate-limit L2 state
- cache / hot state that can be rebuilt

Not allowed:

- durable system-of-record data
- state that cannot tolerate rebuild after restart / recreate

## 5. Persistence and disruption policy

- Persistence is provided by the StatefulSet PVC mounted at `/data`.
- The baseline assumes persistence improves restart quality but does not change the source-of-truth rule.
- `minAvailable=1` PDB is used to block voluntary disruption unless the operator explicitly changes the policy.

## 6. Verification procedure

### 6.1 Baseline apply

1. Enable `enable_standard_dragonfly_baseline`.
2. Set `standard_dragonfly_image`.
3. Apply the environment root.
4. Confirm:
   - namespace `data`
   - StatefulSet `dragonfly`
   - PVC bound
   - service endpoint resolvable

### 6.2 Connectivity check

1. Use an approved client workload in an allowed namespace.
2. Connect to `dragonfly.data.svc.cluster.local:6379`.
3. Run a simple `PING`.
4. Verify readiness stays healthy.

### 6.3 Restart / recreate check

1. Restart the Dragonfly pod.
2. Confirm the StatefulSet recreates the pod and reattaches the PVC.
3. Verify session / rate-limit dependent paths follow ADR-005 and LIN-587 degraded / fallback behavior as needed.

## 7. Memory pressure and failure handling

If memory pressure or restart loops are observed:

1. Confirm current request / limit sizing.
2. Check restart count and recent eviction / OOM signals.
3. Verify whether session / resume and rate-limit behavior match the linked runbooks.
4. If the workload remains unstable:
   - scale down client pressure if possible
   - increase limits in a reviewed change
   - or temporarily disable dependent features that assume warm state

## 8. Rollback

If the standard baseline must be removed:

1. Confirm no app rollout depends on the endpoint.
2. Set `enable_standard_dragonfly_baseline = false`.
3. Apply the environment root.
4. Record whether PVC retention or deletion is desired before cleanup.

## 9. Follow-up boundary

- Replica / failover topology
- metrics / alert automation
- broader east-west policy or service mesh

These stay in later infra issues.
