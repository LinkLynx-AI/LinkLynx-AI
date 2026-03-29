# Managed Messaging Low-budget Operations Runbook

- Owner scope: low-budget `prod-only` managed messaging secret baseline
- Related:
  - `database/contracts/lin601_redpanda_event_stream_baseline.md`
  - `docs/runbooks/realtime-nats-core-subject-subscription-runbook.md`
  - `docs/runbooks/redpanda-topic-retention-replay-runbook.md`
  - `docs/runbooks/workload-identity-secret-manager-operations-runbook.md`
  - `docs/runbooks/managed-messaging-cloud-low-budget-operations-runbook.md`
  - `LIN-1024`

## 1. Purpose

This runbook defines the low-budget `prod-only` baseline for reserving managed messaging connection material in Secret Manager.

This baseline only covers:

- Redpanda / NATS secret inventory
- placeholder creation via Terraform
- fill / verify / rollback procedure

Ownership / incident-triage baseline is handled separately in:

- `docs/runbooks/managed-messaging-cloud-low-budget-operations-runbook.md`

This baseline does **not** cover:

- broker or account provisioning
- runtime client wiring
- publish / subscribe smoke tests
- topic or subject operations

Those remain in standard path `LIN-971`.

## 2. Secret inventory

### Redpanda Cloud

| secret ID | expected value |
| --- | --- |
| `linklynx-prod-redpanda-bootstrap-servers` | comma-separated bootstrap servers |
| `linklynx-prod-redpanda-sasl-username` | SASL username |
| `linklynx-prod-redpanda-sasl-password` | SASL password |

### Synadia / NATS

| secret ID | expected value |
| --- | --- |
| `linklynx-prod-nats-url` | NATS server URL |
| `linklynx-prod-nats-creds` | full `.creds` content or equivalent connection credential |

Even when a value is operationally low-sensitivity, this baseline keeps all managed messaging connection material in Secret Manager so that future runtime wiring can use one retrieval path.

## 3. Enable procedure

In `infra/environments/prod` set:

```hcl
enable_minimal_managed_messaging_secret_baseline = true
```

Optional overrides:

```hcl
minimal_redpanda_secret_ids = [
  "linklynx-prod-redpanda-bootstrap-servers",
  "linklynx-prod-redpanda-sasl-username",
  "linklynx-prod-redpanda-sasl-password",
]

minimal_nats_secret_ids = [
  "linklynx-prod-nats-url",
  "linklynx-prod-nats-creds",
]
```

Then:

1. execute Terraform `plan`
2. verify only Secret Manager resources are added
3. execute Terraform `apply`

## 4. Fill procedure

After apply, add the first secret version for each placeholder.

Reference pattern:

```bash
printf '%s' '<value>' | gcloud secrets versions add <secret-id> --data-file=-
```

Examples:

- Redpanda bootstrap servers as a comma-separated string
- NATS credentials as the raw multi-line `.creds` payload

## 5. Verification

After apply:

1. confirm Terraform outputs show the expected secret IDs
2. confirm `gcloud secrets describe <secret-id>` succeeds for each placeholder
3. confirm labels include `scope=managed-messaging` and the expected dependency marker
4. confirm Secret Manager audit logs are visible via the filter from `docs/runbooks/workload-identity-secret-manager-operations-runbook.md`

## 6. Rotation

1. add a new secret version
2. record which future runtime consumer should adopt the new version
3. once consumers move, disable the old version

Because runtime wiring is not part of this issue, version adoption may happen in a later issue.

## 7. Rollback

If the baseline is no longer needed:

1. set `enable_minimal_managed_messaging_secret_baseline = false`
2. run Terraform `plan`
3. confirm only the placeholder secrets are being removed
4. run Terraform `apply`

If values are wrong but the placeholders should remain, rotate secret versions instead of removing the resources.

## 8. Boundary with standard path

This low-budget path intentionally stops at secret inventory and manual population.

Move to standard `LIN-971` when one or more are true:

- actual Redpanda / NATS runtime clients are ready to connect
- network and auth setup must be codified
- smoke publish/subscribe must be executable from infra docs only
- the team wants managed messaging onboarding to be reproducible end-to-end
