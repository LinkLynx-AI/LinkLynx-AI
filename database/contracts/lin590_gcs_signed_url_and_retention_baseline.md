# LIN-590 GCS Signed URL / Object Key / Retention Baseline

## Purpose

- Target issue: LIN-590
- Fix one v0 operational baseline for attachment binary storage on GCS.
- Provide a stable prerequisite for LIN-597 DR runbook work.

In scope:

- Attachment binary source-of-record boundary for GCS
- Object key naming convention
- Signed URL operation policy (TTL, reissue, failure behavior)
- Versioning, retention, and accidental deletion recovery baseline
- SLO/SLI viewpoints for signed URL issuance

Out of scope:

- Attachment UI implementation
- CDN optimization implementation details
- Runtime API code changes, DB schema changes, or Terraform changes

## References

- `docs/adr/ADR-002-class-ab-event-classification-and-delivery-boundary.md`
- `docs/adr/ADR-001-event-schema-compatibility.md`
- `docs/DATABASE.md`
- `docs/runbooks/gcs-signed-url-retention-operations-runbook.md`
- `LIN-590`
- `LIN-597`

## 1. Source-of-record boundary

- GCS is the source of record for attachment binary objects.
- Postgres/Scylla remain source of record for metadata and message state; they must not duplicate binary payloads.
- This baseline does not redefine event class assignments. Any event behavior decision must follow ADR-002.

## 2. Object key convention

### 2.1 Fixed key pattern

```text
v0/tenant/{tenant_id}/guild/{guild_id}/channel/{channel_id}/message/{message_id}/asset/{asset_id}/{filename}
```

### 2.2 Naming rules

1. Path segments must appear in the fixed order above.
2. `tenant_id`, `guild_id`, `channel_id`, `message_id`, and `asset_id` are required and immutable after issuance.
3. `asset_id` must be unique per attachment object and treated as opaque.
4. `filename` is original-name metadata only; do not use it as identity.
5. Runtime callers must not upload to keys outside this prefix.

### 2.3 Scope note

- v0 baseline fixes this format for current attachment paths.
- Future scope expansion (for example alternate channel domains) requires a new contract update.

## 3. Signed URL policy

### 3.1 TTL (fixed values)

- Upload signed URL TTL: `5 minutes`
- Download signed URL TTL: `5 minutes`

### 3.2 Issuance and usage rules

1. Signed URLs are short-lived and must be generated on demand.
2. Expired URLs are never reused.
3. On expiration, clients must request a newly issued URL.
4. Issuance failures due to dependency outage are treated as unavailable; do not fall back to public object access.

### 3.3 Security baseline

- Objects are private by default.
- Anonymous/public-read exposure is out of scope for v0.
- Signed URL leakage is treated as credential leakage; rotate by reissuing and invalidating stale client state.

## 4. Versioning and retention policy

### 4.1 Bucket safety baseline

- Bucket object versioning must be enabled.
- Deletion operations must be recoverable within the defined protection window.

### 4.2 Retention values

- Accidental deletion recovery protection window: `7 days`
- Physical deletion is allowed only after the window elapses.

### 4.3 Deletion policy

1. Logical/object deletion requests must preserve recoverability during the protection window.
2. Direct hard-delete bypass of the protected window is prohibited in normal operations.
3. Recovery procedures must follow `docs/runbooks/gcs-signed-url-retention-operations-runbook.md`.

## 5. Signed URL SLO/SLI viewpoints

Minimum required viewpoints:

1. Issuance latency: `p95` and `p99`
2. Issuance success rate
3. Reissue rate after expiration
4. Expired URL request ratio

Initial v0 target values:

- Issuance latency target: `p95 <= 200ms`, `p99 <= 400ms`
- Issuance success target: `>= 99.9%` (rolling 30 days)

Operational note:

- Threshold tuning is allowed only with explicit runbook and contract updates.

## 6. Failure and recovery baseline

1. Expired URL:
- Return deterministic expiration error.
- Reissue a new URL and retry upload/download.

2. Accidental deletion within 7-day window:
- Restore object version and reissue download URL.
- Record incident and recovery timestamps.

3. Deletion beyond 7-day window:
- Treat as unrecoverable in-place.
- Escalate with impact scope and remediation plan.

## 7. Change management and compatibility notes

- Retention/TTL policy changes must follow the runbook change procedure.
- This issue does not change event schemas; ADR-001 compatibility checklist is `N/A` for schema diffs.
- Any future event-contract changes for attachment lifecycle must remain additive and follow ADR-001.
