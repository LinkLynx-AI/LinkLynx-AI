# Dragonfly Low-budget Operations Runbook

- Owner scope: low-budget `prod-only` Dragonfly baseline
- Related:
  - `docs/runbooks/dragonfly-ratelimit-operations-runbook.md`
  - `docs/runbooks/session-resume-dragonfly-operations-runbook.md`
  - `docs/runbooks/incident-low-budget-operations-runbook.md`
  - `docs/adr/ADR-005-dragonfly-ratelimit-failure-policy.md`
- Source issues:
  - `LIN-1022`

## 1. Purpose

This runbook defines the infrastructure baseline for Dragonfly on the low-budget `prod-only` path.

This path intentionally keeps Dragonfly:

- single replica
- internal only
- volatile cache/state only
- not a source of record

Restart-time data loss is acceptable on this path and must be absorbed by degraded or fallback behavior defined in ADR-005 and the existing session/resume runbooks.

## 2. Baseline shape

- Kubernetes namespace: `dragonfly`
- Workload kind: `Deployment`
- Replicas: `1`
- Service type: `ClusterIP`
- Service port: `6379`
- Internal endpoint: `dragonfly.dragonfly.svc.cluster.local:6379`

Resource baseline:

- CPU request: `250m`
- CPU limit: `500m`
- Memory request: `512Mi`
- Memory limit: `1Gi`
- Ephemeral storage request: `1Gi`
- Ephemeral storage limit: `2Gi`

## 3. Why this differs from standard path

`LIN-969` standard path assumes stronger isolation and stateful controls.
The low-budget path intentionally does **not** include:

- `StatefulSet`
- persistent volume
- replication
- PDB
- operator-based management

Reason:

- Dragonfly is not the system of record
- the low-budget path prioritizes lower fixed cost over restart continuity
- session/resume and rate-limit policies already define fallback behavior when Dragonfly is unavailable

## 4. Enable procedure

In `infra/environments/prod` set:

```hcl
enable_minimal_dragonfly_baseline = true
minimal_dragonfly_image           = "docker.dragonflydb.io/dragonflydb/dragonfly:vX.Y.Z"
```

Then run the standard low-budget deploy flow:

1. execute Terraform `plan`
2. review the Dragonfly workload diff
3. execute Terraform `apply`

Use the low-budget deploy flow in:

- `docs/runbooks/terraform-low-budget-prod-deploy-runbook.md`

## 5. Verification

After apply:

1. confirm the `dragonfly` Deployment is available
2. confirm the `dragonfly` Service exists in namespace `dragonfly`
3. confirm the endpoint resolves to `dragonfly.dragonfly.svc.cluster.local:6379`
4. confirm dependent application paths still treat Dragonfly as cache/state only

Operationally, verify that:

- Dragonfly loss does not block continuity-sensitive flows beyond documented fallback
- high-risk rate-limit surfaces still follow ADR-005 fail-close behavior when Dragonfly is degraded

## 6. Rollback

If the workload introduces instability or cost pressure:

1. set `enable_minimal_dragonfly_baseline = false`
2. run Terraform `plan`
3. confirm only Dragonfly resources are being removed
4. run Terraform `apply`

Because this path is explicitly volatile-only, removing the workload does not require state preservation.

## 7. Failure handling

- Pod restart or pod eviction:
  - assume Dragonfly-resident state is lost
  - verify fallback behavior using the existing session/resume and rate-limit runbooks
- Sustained OOM or CPU throttling:
  - first increase requests and limits conservatively
  - do not add replication or persistence inside this issue scope
- Continuity regression after Dragonfly restart:
  - treat as policy verification failure first
  - verify ADR-005 and session fallback behavior before scaling the infra shape

## 8. Upgrade trigger

Move from this low-budget baseline to standard `LIN-969` when one or more of the following become true:

- Dragonfly restart continuity becomes materially important
- multiple workloads depend on shared Dragonfly state
- manual tolerance for single-replica interruption is no longer acceptable
- the team needs persistent or isolated Dragonfly behavior beyond cache-only semantics
