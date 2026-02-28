# GCS Signed URL and Retention Operations Runbook (Draft)

- Status: Draft
- Last updated: 2026-02-27
- Owner scope: v0 attachment binary operations baseline
- References:
  - `database/contracts/lin590_gcs_signed_url_and_retention_baseline.md`
  - `docs/adr/ADR-002-class-ab-event-classification-and-delivery-boundary.md`
  - `docs/DATABASE.md`
  - `LIN-590`
  - `LIN-597`

## 1. Purpose and scope

This runbook defines execution steps for signed URL issuance flow, expired URL reissuance, accidental deletion recovery, and retention policy updates for v0 attachment binaries on GCS.

In scope:

- Normal signed URL issuance to upload completion checks
- Expired URL reissuance flow
- Recovery flow for accidental deletion within 7-day protection window
- Retention policy change procedure with impact checks

Out of scope:

- CDN optimization
- Public object distribution model
- Infrastructure-as-code implementation details

## 2. Fixed baseline summary

| item | value |
| --- | --- |
| Upload signed URL TTL | 5 minutes |
| Download signed URL TTL | 5 minutes |
| Object key pattern | `v0/tenant/{tenant_id}/guild/{guild_id}/channel/{channel_id}/message/{message_id}/asset/{asset_id}/{filename}` |
| Versioning | Enabled |
| Recovery protection window | 7 days |

## 3. Procedure A: Normal issuance and upload completion

### 3.1 Start conditions

- Valid attachment metadata exists (`tenant/guild/channel/message/asset` identifiers).
- Request is authorized by current application auth rules.

### 3.2 Steps

1. Build object key using fixed naming convention.
2. Issue upload signed URL with `TTL=5 minutes`.
3. Client uploads object to issued URL.
4. Verify object existence and metadata linkage.
5. Issue download signed URL with `TTL=5 minutes` only when needed by consumer path.

### 3.3 Close conditions

- Upload completes within URL validity window.
- Object key and metadata mapping are consistent.

## 4. Procedure B: Expired URL reissuance

### 4.1 Start conditions

- Upload or download request fails with expiration-class error.

### 4.2 Steps

1. Confirm original URL is expired (not authz deny / not object missing).
2. Generate a new signed URL with the same key and baseline TTL.
3. Return deterministic retry instruction to caller.
4. Record reissuance metrics (`expired_url_ratio`, `reissue_count`).

### 4.3 Close conditions

- Caller receives new URL and can retry path.
- Expired URL is not reused.

## 5. Procedure C: Accidental deletion recovery

### 5.1 Start conditions

- Object missing/deleted is detected for an existing metadata record.
- Deletion event timestamp is within 7-day protection window.

### 5.2 Steps

1. Identify target object key and affected scope (tenant/guild/channel/message/asset).
2. Inspect available object versions.
3. Restore the latest valid version to active state.
4. Re-validate object availability and metadata linkage.
5. Reissue download signed URL.
6. Log incident timeline and root cause candidate.

### 5.3 If outside protection window

1. Mark as unrecoverable in-place.
2. Escalate with impact scope and user-facing mitigation plan.
3. Create follow-up action items for prevention.

### 5.4 Close conditions

- Recovery completed and object can be downloaded again, or escalation is formally recorded for unrecoverable case.

## 6. Procedure D: Retention policy change

### 6.1 Pre-check

1. Define business reason and target value change.
2. Estimate storage and recovery impact.
3. Confirm compatibility with DR requirements (LIN-597 dependency).
4. Prepare rollback criteria before apply.

### 6.2 Apply sequence

1. Apply policy update in staging-equivalent environment first.
2. Validate new and existing objects follow expected lifecycle behavior.
3. Apply to target environment after validation pass.
4. Update related contract/runbook docs in the same change set.

### 6.3 Post-check

1. Verify no unexpected early physical deletion.
2. Verify recovery path still works within configured protection window.
3. Verify monitoring dashboards reflect new thresholds/targets.

### 6.4 Rollback rule

- If unexpected deletion or recovery regression is detected, roll back to previous retention configuration immediately and open incident tracking.

## 7. Monitoring and alert viewpoints

Minimum monitor items:

- Signed URL issuance latency (`p95`, `p99`)
- Signed URL issuance success rate
- Expired URL ratio / reissuance ratio
- Recovery success/failure counts for accidental deletion

Initial alert viewpoints:

1. Issuance success drops below SLO target.
2. Expired URL ratio spikes above baseline for sustained windows.
3. Recovery failure occurs within 7-day protection window.

## 8. Handover checklist for LIN-597 (DR v0)

1. Recovery start/close conditions are objective and testable.
2. 7-day recovery-window rule is reflected in DR tabletop scenarios.
3. Incident recording template includes object key scope and recovery timing.
4. Runbook links remain valid from parent/child issue references.
