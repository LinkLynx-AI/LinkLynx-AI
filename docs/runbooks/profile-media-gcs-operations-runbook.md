# Profile Media GCS Operations Runbook

- Status: Draft
- Last updated: 2026-03-08
- Owner scope: v0 profile avatar/banner binary operations baseline
- References:
  - `database/contracts/lin939_profile_media_gcs_contract.md`
  - `database/contracts/lin590_gcs_signed_url_and_retention_baseline.md`
  - `docs/DATABASE.md`
  - `LIN-886`
  - `LIN-939`

## 1. Purpose and scope

This runbook defines the execution baseline for profile avatar/banner signed URL issuance, object upload verification, expired URL reissuance, and environment configuration checks on GCS.

In scope:

- Same-bucket avatar/banner operations
- Upload/download signed URL issuance
- Local/staging/prod credential prerequisites
- Missing-key and dependency-unavailable triage

Out of scope:

- UI preview/crop behavior
- Public CDN distribution
- Terraform provisioning details

## 2. Fixed baseline summary

| item | value |
| --- | --- |
| Bucket topology | one profile-media bucket per environment |
| Target split | `profile/avatar` and `profile/banner` path segments |
| Upload signed URL TTL | 5 minutes |
| Download signed URL TTL | 5 minutes |
| Object key pattern | `v0/tenant/default/user/{user_id}/profile/{avatar\|banner}/asset/{asset_id}/{filename}` |
| Upload method | `PUT` |
| Object visibility | private only |

## 3. Environment prerequisites

### 3.1 Required runtime env

- `PROFILE_GCS_BUCKET`
- `GOOGLE_APPLICATION_CREDENTIALS` for local development

### 3.2 Credential model

1. Local:
   - Use a service account JSON file.
   - Point `GOOGLE_APPLICATION_CREDENTIALS` to that file path.
2. Staging/production:
   - Use the workload/service-account identity attached to the runtime.
   - Keep the bucket private and signer permissions minimal.

### 3.3 Bucket baseline

1. Avatar and banner use the same bucket.
2. Bucket object versioning should stay enabled per LIN-590 baseline.
3. Do not enable anonymous/public read for this bucket.
4. CORS must allow the application origin to perform signed `PUT` uploads and object reads through signed URLs.

## 4. Procedure A: Upload flow verification

### 4.1 Start conditions

- Authenticated user exists.
- Runtime env is configured.
- Requested `target`, `filename`, and `content_type` pass validation.

### 4.2 Steps

1. Call `POST /users/me/profile/media/upload-url`.
2. Confirm response contains `object_key`, `upload_url`, `method=PUT`, `required_headers`, and `expires_at`.
3. Upload the binary via signed `PUT`.
4. Persist the returned `object_key` through `PATCH /users/me/profile`.
5. Call `GET /users/me/profile/media/{target}/download-url`.
6. Confirm the returned `object_key` matches the persisted key.

### 4.3 Close conditions

- Object upload succeeds.
- Persisted key matches the downloaded target.
- Download URL is reissued on demand and remains short-lived.

## 5. Procedure B: Missing key triage

### 5.1 Trigger

- `GET /users/me/profile/media/{target}/download-url` returns `PROFILE_MEDIA_NOT_FOUND`.

### 5.2 Steps

1. Confirm whether the caller has persisted `avatar_key` or `banner_key`.
2. If the key is intentionally unset, treat as expected empty state.
3. If the key should exist, verify the previous `PATCH /users/me/profile` completed successfully.
4. Re-run upload flow only after the persistence gap is identified.

## 6. Procedure C: Dependency unavailable triage

### 6.1 Trigger

- upload/download URL issuance returns `PROFILE_MEDIA_UNAVAILABLE`

### 6.2 Steps

1. Check `PROFILE_GCS_BUCKET` is set to the expected environment bucket.
2. In local, check `GOOGLE_APPLICATION_CREDENTIALS` points to a readable service-account JSON file.
3. In staging/production, verify the runtime service account has signing access to the bucket.
4. Confirm the bucket still exists and the configured signer identity can generate V4 signed URLs.
5. Retry issuance after configuration is repaired.

### 6.3 Close conditions

- Signed URL issuance returns `200`.
- No public-read fallback or alternate storage path was used.

## 7. Procedure D: Expired URL reissuance

1. Treat upload/download expiration as expected short-lived credential expiry.
2. Request a new signed URL for the same target.
3. Do not attempt to reuse the expired URL.
4. If expiration repeats abnormally, inspect client clock skew and retry timing.

## 8. Change management notes

1. Bucket split between avatar/banner is out of scope for v0 and requires a new contract update.
2. TTL changes must stay aligned with LIN-590 or be explicitly superseded.
3. Runtime/API changes must preserve `key persistence + signed URL reissue` as the display contract for LIN-886.
