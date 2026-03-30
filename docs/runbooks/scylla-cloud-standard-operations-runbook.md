# ScyllaDB Cloud Standard Operations Runbook

- Status: Draft
- Last updated: 2026-03-29
- Owner scope: standard path ScyllaDB Cloud connection baseline on `staging` / `prod`
- References:
  - `database/contracts/lin589_scylla_sor_partition_baseline.md`
  - `docs/runbooks/scylla-node-loss-backup-runbook.md`
  - `docs/runbooks/workload-identity-secret-manager-standard-operations-runbook.md`
  - `LIN-970`

## 1. Purpose and scope

This runbook defines the standard path operating baseline for connecting LinkLynx workloads to ScyllaDB Cloud.

In scope:

- staging / prod environment split
- runtime contact-point contract
- Secret Manager inventory and rotation baseline
- provider vs LinkLynx responsibility split
- backup / restore / schema ownership boundary
- self-managed fallback boundary

Out of scope:

- Terraform-based ScyllaDB Cloud account or cluster provisioning
- application-side query design
- DR architecture beyond the baseline handoff to LIN-589 / LIN-597

## 2. Hosting baseline

The standard path uses ScyllaDB Cloud as the external message source-of-record backend.

Baseline assumptions:

- `staging` and `prod` do not share a cluster
- each environment has its own contact points
- runtime workloads connect with authentication enabled
- runtime workloads use TLS with a provider CA bundle
- `SCYLLA_HOSTS` is environment-scoped and managed in Terraform input
- credential material is distributed through Secret Manager

Default runtime consumer:

- `api` workload only

If another workload needs direct Scylla access, extend the accessor list in Terraform and review the blast radius explicitly.

## 3. Secret inventory baseline

Required Secret Manager entries:

| Secret role | Expected content |
| --- | --- |
| `username` | ScyllaDB Cloud username |
| `password` | ScyllaDB Cloud password or token |
| `ca_bundle` | PEM bundle used by the runtime TLS client |

Baseline runtime contract:

- hosts: Terraform variable, not secret
- keyspace: Terraform variable, default `chat`
- schema path: `/app/database/scylla/001_lin139_messages.cql`
- request timeout: `1000ms`
- shard-aware port: disabled by default for cloud/NAT uncertainty

## 4. Rotation baseline

When credential rotation is required:

1. issue or retrieve the next credential set from ScyllaDB Cloud
2. create new Secret Manager secret versions for `username`, `password`, and `ca_bundle` if changed
3. verify runtime access policy still targets the intended GSA only
4. roll the consumer workload in `staging`
5. confirm `/internal/scylla/health` leaves `config_invalid` and does not regress to `connect_failed`
6. promote the same rotation flow to `prod`
7. revoke the old provider credential after runtime verification closes

Do not delete the previous secret version before the workload has been verified on the new credential.

## 5. Network and connectivity baseline

Terraform owns:

- environment-scoped contact-point contract
- secret inventory
- secret accessor IAM for approved runtime workloads

Terraform does not own:

- ScyllaDB Cloud account setup
- provider-side network allowlist / private connectivity objects
- provider-side backup policy configuration

Before production use, record one of the following for each environment:

- provider-side IP allowlist evidence, or
- private connectivity evidence, or
- explicit risk acceptance for temporary public egress

If none is available, do not call the environment “production ready”.

## 6. Responsibility split

| Area | ScyllaDB Cloud / provider owner | LinkLynx |
| --- | --- | --- |
| Cluster/node availability | owns | monitors and escalates |
| Provider backup mechanism | provides | verifies freshness and restore path |
| Contact points | provides | stores in Terraform input and reviews drift |
| Runtime secret distribution | no | owns via Secret Manager + Workload Identity |
| Schema ownership | no | owns via LIN-589 contract |
| Restore decision | no | owns |
| Self-managed fallback decision | no | owns |

## 7. Backup / restore / schema boundary

LIN-589 remains the SoR and restore policy SSOT.

Standard path adds these requirements:

- backup evidence must reference the environment-specific ScyllaDB Cloud cluster
- schema snapshot must stay aligned with the backup tag
- restore drill evidence must identify whether the provider performed the data restore or LinkLynx executed the recovery steps
- schema changes must remain additive unless a separate contract explicitly approves otherwise

If backup freshness or restore readiness is unknown, pause risky rollout activity.

## 8. Verification procedure

### 8.1 Terraform baseline

1. enable `enable_standard_scylla_cloud_baseline`
2. set `standard_scylla_hosts`
3. confirm `enable_standard_workload_identity_baseline = true`
4. apply the environment root
5. confirm Secret Manager contains the expected `username`, `password`, and `ca_bundle` secret objects
6. confirm the approved runtime GSA has `roles/secretmanager.secretAccessor` on those secrets

### 8.2 Runtime smoke

This baseline expects the downstream runtime issue to consume the secrets and hosts contract.

Once a standard path runtime workload exists:

1. inject the credential material through the workload secret retrieval path
2. confirm `/internal/scylla/health` does not return `config_invalid`
3. confirm connection reaches `ready` or a dependency-specific state that proves the credential/TLS path is active
4. record the environment, contact points, and secret version used for the smoke

## 9. Rollback

If the standard baseline must be rolled back:

1. disable `enable_standard_scylla_cloud_baseline`
2. confirm the plan removes only the Scylla secret inventory / IAM attachments
3. apply the environment root
4. if a runtime rollout consumed the new credential, roll back that workload separately
5. keep previous credential versions until the rollback closes

## 10. Self-managed fallback boundary

Do not mix self-managed GCE Scylla provisioning into this issue.

Open a separate issue when one of the following becomes true:

- ScyllaDB Cloud cost or control surface is no longer acceptable
- provider network posture cannot satisfy the required risk level
- restore / backup needs exceed provider capability
- team decides to run Scylla on GCE or future GKE Standard directly

The fallback contract should preserve:

- Scylla as message SoR
- environment split between staging and prod
- runtime secret / credential boundary
- LIN-589 backup / restore gates
