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
6. An uploaded object that never reaches a successful `PATCH /users/me/profile` is treated as an orphan candidate and must be cleaned up via the profile media runbook while preserving LIN-590 recoverability.

## 4. Signed URL policy

### 4.1 TTL

- Upload signed URL TTL: `5 minutes`
- Download signed URL TTL: `5 minutes`

### 4.2 Usage rules

1. Upload uses direct `PUT`.
2. Signed URLs are generated on demand and are never reused after expiration.
3. Upload signed URL binds the requested `content_type` and exact `content_length` (`size_bytes`) to the issued contract.
4. Public-read fallback is prohibited.
5. If bucket configuration or signer credentials are unavailable, the API must fail closed with service-unavailable semantics.

### 4.3 Allowed MIME and size limits

| target | allowed MIME types | max upload size |
| --- | --- | --- |
| `avatar` | `image/png`, `image/jpeg`, `image/gif`, `image/webp`, `image/avif` | `2 MiB` |
| `banner` | `image/png`, `image/jpeg`, `image/gif`, `image/webp`, `image/avif` | `6 MiB` |

## 5. API contract summary

### 5.1 Upload URL issuance

- Endpoint: `POST /users/me/profile/media/upload-url`
- Request:
  - `target`
  - `filename`
  - `content_type`
  - `size_bytes`
  - known image extensions must stay consistent with the requested `content_type`
  - `content_type` must stay within the fixed allowlist; `image/svg+xml` and other non-allowlisted formats are rejected before URL issuance
  - `size_bytes` must stay within the target-specific maximum
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
  - invalid `target`, `filename`, `content_type`, `size_bytes`, or invalid persisted object key format
- `PROFILE_MEDIA_NOT_FOUND`
  - caller has no persisted key for the requested target
- `PROFILE_MEDIA_UNAVAILABLE`
  - bucket/signer configuration is missing or signed URL issuance fails due to dependency unavailability

## 7. Compatibility notes

- This contract is additive to the existing profile API.
- `users.banner_key` is introduced as a nullable additive column.
- Event schema compatibility checklist (ADR-001): `N/A` because no event payload change is in scope.
