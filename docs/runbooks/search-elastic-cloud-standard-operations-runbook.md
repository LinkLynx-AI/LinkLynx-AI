# Search Elastic Cloud Standard Operations Runbook

- Status: Draft
- Last updated: 2026-03-30
- Owner scope: standard path `staging` / `prod` Elastic Cloud search baseline
- References:
  - [ADR-003 Search Consistency Model, Lag SLO, and Reindex Strategy](../adr/ADR-003-search-consistency-slo-reindex.md)
  - [Search Reindex Runbook (Draft)](./search-reindex-runbook.md)
  - [Observability Standard Operations Runbook](./observability-standard-operations-runbook.md)
  - [Workload Identity Secret Manager Standard Operations Runbook](./workload-identity-secret-manager-standard-operations-runbook.md)
  - [LIN-139 runtime contracts](../../database/contracts/lin139_runtime_contracts.md)
  - `LIN-975`

## 1. Purpose and scope

This runbook defines the standard path operating baseline for LinkLynx search on `Elastic Cloud`.

In scope:

- hosting decision record for standard path
- staging / prod environment split
- Secret Manager inventory and accessor IAM for approved runtime workloads
- runtime locator / authentication contract
- connectivity smoke baseline
- snapshot / restore / incident triage baseline
- vendor vs LinkLynx responsibility split
- observability seed for reachability and provider-side health

Out of scope:

- Elastic Cloud deployment creation automation
- self-managed OpenSearch provisioning
- runtime relevance tuning or index schema redesign
- provider-native metrics ingestion into the in-cluster observability stack

## 2. Hosting decision

### 2.1 Compared options

| Option | Strengths | Weaknesses |
| --- | --- | --- |
| `Elastic Cloud` | lowest day-2 ops burden, built-in managed snapshots, simpler HA / upgrade posture, faster Phase 1 delivery | SaaS cost, vendor control surface, provider boundary must be documented |
| `OpenSearch self-managed` | more direct infra control, easier to colocate with future self-hosted move | cluster lifecycle / patching / snapshot / scaling / incident burden falls on LinkLynx immediately |

### 2.2 Adopted baseline

- Standard path adopts `Elastic Cloud`.
- `OpenSearch self-managed` remains an explicit fallback only if:
  - provider cost becomes unacceptable,
  - required network posture cannot be achieved, or
  - control / portability needs exceed the managed service boundary.

Reasoning:

- current Phase 1 goal is `single-cloud GCP` with low operating burden
- search is a derived read model, so immediate correctness risk is lower than Scylla / Postgres
- portability is preserved at the client / secret / contract boundary without taking on cluster operations today

## 3. Runtime connection baseline

Baseline assumptions:

- `staging` and `prod` do not share Elastic Cloud deployments or credentials
- default runtime accessor is `api` only unless Terraform input expands it
- authentication mode is `API key`
- locator mode supports both `cloud_id` and raw `endpoint`
- runtime index name stays `messages` per `lin139_runtime_contracts.md`

Required Secret Manager entries:

| Secret role | Expected content |
| --- | --- |
| `api_key` | raw API key value without the `ApiKey ` prefix |
| `cloud_id` | Elastic Cloud `cloud_id` string |
| `endpoint` | full HTTPS endpoint such as `https://cluster-id.region.gcp.cloud.es.io:443` |

Operational rule:

- before runtime rollout, at least one of `cloud_id` or `endpoint` must contain a usable current secret version
- `api_key` must always have an enabled current version

## 4. Network and connectivity baseline

Terraform owns:

- secret object inventory
- secret-level accessor IAM for approved workloads
- environment-specific search probe target inputs

Terraform does not own:

- Elastic Cloud deployment creation
- provider-side IP allowlist / private connectivity objects
- provider-side snapshot repository creation outside the managed default

Before production readiness is declared, record one of the following per environment:

- provider-side allowlist evidence
- private connectivity evidence
- explicit risk acceptance for temporary public egress over TLS

## 5. Snapshot / restore / recovery baseline

Standard path keeps `Elastic Cloud` default managed snapshot behavior unless a follow-up issue explicitly changes it.

Minimum baseline:

1. keep the provider-managed snapshot policy enabled
2. confirm snapshot freshness in the provider console before risky rollout work
3. rehearse same-environment restore in `staging` first
4. treat `Scylla` as the correctness source for rebuilds; use `search-reindex-runbook.md` when index drift or restore requires replay

Recovery decision order:

1. check cluster health and provider incident state
2. if search is degraded but Scylla is healthy, keep write path running and degrade search per ADR-003
3. if provider restore is required, restore the deployment/index and then verify lag convergence
4. if restore freshness is insufficient, rebuild from Scylla using reindex flow

## 6. Responsibility split

| Area | Elastic Cloud / vendor | LinkLynx |
| --- | --- | --- |
| deployment availability | owns | monitors and escalates |
| managed snapshots default behavior | provides | verifies freshness and restore viability |
| credential issuance in provider portal | provides | rotates and stores in Secret Manager |
| secret distribution to workloads | no | owns via Workload Identity + Secret Manager |
| search consistency and reindex policy | no | owns via ADR-003 and runbooks |
| index mapping / lifecycle decisions | no | owns |
| self-managed fallback decision | no | owns |

## 7. Observability baseline

In-cluster baseline:

- when `enable_standard_observability_baseline = true`, set `standard_search_probe_targets`
- these targets are added to the dependency probe dashboard as `dependency=search`

Provider-side first check sources:

- search latency: deployment performance view / provider metrics
- indexing error: application logs and provider-side error indicators
- cluster health: Elastic deployment health / Elasticsearch cluster health
- storage: deployment storage usage / disk watermarks
- snapshot success: managed snapshot status / last successful snapshot timestamp

This issue does not ingest those provider-native signals into Prometheus yet. Treat them as operator runbook checks until a follow-up issue adds that integration.

## 8. Verification procedure

### 8.1 Terraform baseline

1. set `enable_standard_search_baseline = true`
2. confirm `enable_standard_workload_identity_baseline = true`
3. set `standard_search_runtime_workloads`
4. if observability is enabled, set at least one `standard_search_probe_targets` entry
5. apply the environment root
6. confirm Secret Manager contains `api_key`, `cloud_id`, and `endpoint` secret objects
7. confirm the approved runtime GSA has `roles/secretmanager.secretAccessor` on those secrets

### 8.2 Staging connectivity smoke

After secret values are populated:

1. fetch the latest `api_key` and chosen locator secret (`cloud_id` or `endpoint`)
2. use a provider-approved client or `curl` against the environment deployment
3. confirm `/_cluster/health` returns successfully
4. index one smoke document into a staging-only smoke path or approved non-serving scope
5. run one query and confirm the document is searchable
6. remove the smoke document or use a dedicated smoke marker field

### 8.3 Rotation smoke

1. add new Secret Manager versions
2. roll the staging workload or smoke client
3. repeat cluster health and query smoke
4. promote the same rotation to `prod`
5. revoke the old provider credential only after verification closes

## 9. Rollback

1. if the latest credential is wrong, add a corrected new secret version first
2. roll back the consuming workload or smoke client to the previous working version
3. disable or pin the bad secret version only after the previous version is confirmed healthy
4. if the Terraform baseline itself must be rolled back, set `enable_standard_search_baseline = false` and confirm only the search secret inventory / IAM attachments are removed

Do not destroy secret objects while a workload still depends on them.

## 10. Self-managed fallback boundary

Open a separate issue for self-managed OpenSearch only when one of the following becomes true:

- Elastic Cloud cost or control surface becomes unacceptable
- required private connectivity / compliance posture cannot be met
- snapshot / restore requirements exceed the managed boundary
- long-term physical server migration requires ownership of the entire search cluster lifecycle

The fallback must preserve:

- `messages` index contract from `lin139_runtime_contracts.md`
- ADR-003 derived read model and reindex policy
- environment split between `staging` and `prod`
- Workload Identity + Secret Manager based credential boundary
