# LIN-939 Profile Media GCS Contract

## Purpose

- Target issue: LIN-939
- Fix the v0 contract for profile avatar/banner binary storage on GCS.
- Provide the minimum API/runtime boundary required by LIN-886.

In scope:

- Profile media source-of-record boundary
- Object key naming convention for avatar/banner
- Signed URL issuance contract for upload/download
- `users.avatar_key` / `users.banner_key` persistence responsibility
- Failure contract for profile media dependency unavailability

Out of scope:

- Profile UI implementation
- Client-side crop/preview flow
- CDN/public object distribution
- Terraform/IaC provisioning details

## References

- `database/contracts/lin590_gcs_signed_url_and_retention_baseline.md`
- `docs/DATABASE.md`
- `docs/runbooks/profile-media-gcs-operations-runbook.md`
- `LIN-886`
- `LIN-939`

## 1. Source-of-record boundary

- GCS is the source of record for profile avatar/banner binary objects.
- Postgres stores only the selected object key in `users.avatar_key` and `users.banner_key`.
- Profile reads must not treat stored keys as public URLs.

## 2. Object key convention

### 2.1 Fixed key pattern

```text
v0/tenant/default/user/{user_id}/profile/{avatar|banner}/asset/{asset_id}/{filename}
```

### 2.2 Naming rules

1. `user_id`, `target`, `asset_id`, and `filename` must appear in the fixed order above.
2. `target` is limited to `avatar` or `banner`.
3. `asset_id` must be a UUID v4 and is the identity of the object.
4. `filename` is display metadata only and must be path-safe sanitized before key generation.
5. Runtime callers must not upload outside the fixed prefix.

## 3. Storage and persistence contract

1. Avatar and banner objects share one environment-specific GCS bucket.
2. Target separation is done by the `profile/{avatar|banner}` path segment, not by separate buckets.
3. `POST /users/me/profile/media/upload-url` issues a key and signed upload URL, but does not persist the key.
4. `PATCH /users/me/profile` is the only API that persists `avatar_key` / `banner_key`.
5. `GET /users/me/profile/media/{target}/download-url` resolves the currently persisted key for the caller and issues a short-lived download URL.

## 4. Signed URL policy

### 4.1 TTL

- Upload signed URL TTL: `5 minutes`
- Download signed URL TTL: `5 minutes`

### 4.2 Usage rules

1. Upload uses direct `PUT`.
2. Signed URLs are generated on demand and are never reused after expiration.
3. Public-read fallback is prohibited.
4. If bucket configuration or signer credentials are unavailable, the API must fail closed with service-unavailable semantics.

## 5. API contract summary

### 5.1 Upload URL issuance

- Endpoint: `POST /users/me/profile/media/upload-url`
- Request:
  - `target`
  - `filename`
  - `content_type`
  - known image extensions must stay consistent with the requested `content_type`
- Response:
  - `object_key`
  - `upload_url`
  - `method=PUT`
  - `required_headers`
  - `expires_at`

### 5.2 Download URL issuance

- Endpoint: `GET /users/me/profile/media/{target}/download-url`
- Response:
  - `object_key`
  - `download_url`
  - `expires_at`

## 6. Error contract

- `VALIDATION_ERROR`
  - invalid `target`, `filename`, `content_type`, or invalid persisted object key format
- `PROFILE_MEDIA_NOT_FOUND`
  - caller has no persisted key for the requested target
- `PROFILE_MEDIA_UNAVAILABLE`
  - bucket/signer configuration is missing or signed URL issuance fails due to dependency unavailability

## 7. Compatibility notes

- This contract is additive to the existing profile API.
- `users.banner_key` is introduced as a nullable additive column.
- Event schema compatibility checklist (ADR-001): `N/A` because no event payload change is in scope.
