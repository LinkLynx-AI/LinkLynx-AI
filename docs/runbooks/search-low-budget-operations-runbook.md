# Search Low-budget Operations Runbook

- Status: Draft
- Last updated: 2026-03-29
- Owner scope: low-budget `prod-only` search secret baseline
- References:
  - [ADR-003 Search Consistency Model, Lag SLO, and Reindex Strategy](../adr/ADR-003-search-consistency-slo-reindex.md)
  - [Search Reindex Runbook (Draft)](./search-reindex-runbook.md)
  - [Search Elastic Cloud Low-budget Operations Runbook](./search-elastic-cloud-low-budget-operations-runbook.md)
  - [LIN-139 runtime contracts](../../database/contracts/lin139_runtime_contracts.md)
  - [Workload Identity Secret Manager Operations Runbook](./workload-identity-secret-manager-operations-runbook.md)

## 1. Purpose and scope

This runbook defines how the low-budget `prod-only` path stores search connection material before runtime wiring or hosting automation is added.

In scope:

- Secret Manager inventory for Elastic Cloud connection material
- Expected secret payload semantics
- Fill, verify, and rollback procedure

Out of scope:

- Elastic Cloud deployment creation
- OpenSearch self-managed provisioning
- Runtime client wiring and smoke tests
- Index lifecycle, snapshot, and reindex execution details

Lifecycle / snapshot / restore baseline is documented in `search-elastic-cloud-low-budget-operations-runbook.md`.

## 2. Baseline choice

- Low-budget path fixes `Elastic Cloud` as the initial search hosting assumption.
- Standard path `LIN-975` keeps the broader hosting comparison, runtime connectivity, and lifecycle responsibilities.
- Search remains a derived read model. Scylla stays the source of truth per ADR-003 and `lin139_runtime_contracts.md`.

## 3. Secret inventory

Create these secret placeholders when `enable_minimal_search_secret_baseline = true`.

| Secret ID | Required | Expected payload |
| --- | --- | --- |
| `linklynx-prod-search-elastic-cloud-id` | optional | Elastic Cloud `cloud_id` string. Preferred when official clients use cloud ID mode. |
| `linklynx-prod-search-elastic-endpoint` | optional | Full HTTPS endpoint, for example `https://cluster-id.region.gcp.cloud.es.io:443`. Use when runtime connects by raw URL instead of cloud ID. |
| `linklynx-prod-search-elastic-api-key` | required | Raw API key token value without the `ApiKey ` prefix. Runtime adds the auth scheme later. |

At least one of `cloud_id` or `endpoint` must be populated before runtime wiring is enabled.

Do not create a separate secret for the index name in the low-budget path. The baseline index name stays `messages` under `lin139_runtime_contracts.md`.

## 4. Fill procedure

1. Apply Terraform with `enable_minimal_search_secret_baseline = true`.
2. Confirm the placeholder inventory exists in Secret Manager.
3. Add a secret version to `linklynx-prod-search-elastic-api-key`.
4. Add a secret version to either:
   - `linklynx-prod-search-elastic-cloud-id`, or
   - `linklynx-prod-search-elastic-endpoint`
5. Record which mode is chosen in the deploy note or issue comment.

## 5. Verify procedure

1. Run `terraform output search_secret_placeholders` in `infra/environments/prod`.
2. Confirm all expected secret IDs are listed.
3. Run `gcloud secrets versions list <secret-id> --project linklynx-prod` for:
   - `linklynx-prod-search-elastic-api-key`
   - the chosen locator secret (`cloud-id` or `endpoint`)
4. Confirm latest secret versions exist and are enabled.
5. Review Secret Manager audit logs if a workload has already started reading them.

## 6. Rollback procedure

Use the smallest possible rollback.

1. If a secret value is wrong, add a new corrected secret version instead of deleting the secret.
2. Disable the incorrect secret version only after the corrected one is confirmed.
3. If the whole baseline was enabled by mistake and no runtime depends on it yet, set `enable_minimal_search_secret_baseline = false` and apply Terraform.
4. If runtime is already reading the secrets, do not destroy placeholders until the workload has been redirected or the feature is disabled.

## 7. Handoff to standard path

Keep the following in `LIN-975`:

- Elastic Cloud vs OpenSearch self-managed comparison as a lasting decision
- Network connectivity and traffic filtering
- Runtime env wiring and smoke tests
- Snapshot, lifecycle, and reindex operational ownership

This low-budget baseline only reserves storage for connection material so later runtime work can reuse the same Secret Manager path.
