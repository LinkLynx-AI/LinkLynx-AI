# Firebase Auth / principal_id Operations Runbook (Draft)

- Status: Draft
- Last updated: 2026-02-28
- Owner scope: v0 auth operations baseline for REST/WS shared authentication
- References:
  - [ADR-005 Dragonfly Outage RateLimit Failure Policy (Hybrid)](../adr/ADR-005-dragonfly-ratelimit-failure-policy.md)
  - [Edge REST/WS Routing and WS Drain Runbook](./edge-rest-ws-routing-drain-runbook.md)
  - [LIN-586](https://linear.app/linklynx-ai/issue/LIN-586)
  - [LIN-618](https://linear.app/linklynx-ai/issue/LIN-618)
  - [LIN-623](https://linear.app/linklynx-ai/issue/LIN-623)

## 1. Purpose and scope

This runbook fixes one operations baseline for Firebase authentication and `principal_id` mapping behavior used by both REST and WS.

In scope:

- Shared error policy mapping for REST/WS authentication failures
- Required audit log fields and minimum authentication metrics
- Failure triage for JWKS retrieval issues, cache outage, and Firebase dependency outage
- Verification procedure for valid/expired/revoked-equivalent token paths

Out of scope:

- AuthZ policy decisions (covered by ADR-004 and downstream issues)
- Additional identity providers
- Full session resume semantics (covered by LIN-587)

## 2. Shared authentication contract (REST / WS)

### 2.1 principal mapping

- External identity source of truth: Firebase ID token (`sub` = UID)
- Internal principal contract: `uid -> principal_id`
- Mapping source: `auth_identities(provider, provider_subject) -> users.id`

### 2.2 Error mapping policy

| failure class | REST | WS close code | app-level code |
| --- | --- | --- | --- |
| missing/invalid/expired token | `401` | `1008` | `AUTH_MISSING_TOKEN` / `AUTH_INVALID_TOKEN` / `AUTH_TOKEN_EXPIRED` |
| principal mapping missing/invalid | `403` | `1008` | `AUTH_PRINCIPAL_NOT_MAPPED` |
| auth dependency unavailable (JWKS/cache/store) | `503` | `1011` | `AUTH_UNAVAILABLE` |

### 2.3 WS token expiry and reauthentication

- On expiry during active WS session, server sends `auth.reauthenticate` request with deadline.
- Client must send `auth.reauthenticate` with a new token before the deadline.
- While reauthentication is pending, application messages other than `auth.reauthenticate` are rejected and the session is closed with `1008` (`reauth_required`).
- If reauthentication fails or deadline passes, server closes with:
  - `1008` for deterministic auth failure
  - `1011` for dependency unavailability

### 2.4 Runtime configuration safety defaults

- `DATABASE_URL` is required for runtime principal mapping in normal operation.
- If `DATABASE_URL` is missing, principal resolution is fail-close by default (`AUTH_UNAVAILABLE`).
- Local/dev-only fallback to seeded in-memory mappings is opt-in via:
  - `AUTH_ALLOW_IN_MEMORY_PRINCIPAL_STORE=true`
  - `AUTH_UID_PRINCIPAL_SEEDS=uidA=1001,uidB=1002`
- Firebase issued-at skew tolerance is configurable via:
  - `FIREBASE_IAT_SKEW_SECONDS` (default: `60`)
- Principal store retry behavior is configurable via:
  - `AUTH_PRINCIPAL_STORE_MAX_RETRIES` (default: `2`)
  - `AUTH_PRINCIPAL_STORE_RETRY_BASE_BACKOFF_MS` (default: `25`)
- Postgres transport is TLS-required by default.
  - Current implementation is fail-close when TLS is required and no TLS connector is configured.
  - Temporary plaintext opt-out is possible only with explicit:
    - `AUTH_ALLOW_POSTGRES_NOTLS=true` (local/development only)

## 3. Required logs and audit fields

Minimum required log fields on authentication decision paths:

- `request_id`
- `principal_id` (when resolved)
- `firebase_uid` (when available)
- `decision` (`allow` / `deny` / `unavailable`)
- `error_class` (for non-allow decisions)
- `reason`

Operational rule:

- Authentication events without `request_id` are non-compliant.
- Protected endpoint accesses without `principal_id` on allow decisions are non-compliant.

## 4. Minimum metrics baseline

Required counters/gauges:

- `auth_token_verify_success_total`
- `auth_token_verify_failure_total`
- `auth_token_verify_unavailable_total`
- `auth_token_verify_latency_avg_ms`
- `auth_principal_cache_hit_total`
- `auth_principal_cache_miss_total`
- `auth_principal_cache_hit_ratio`
- `auth_ws_reauth_success_total`
- `auth_ws_reauth_failure_total`

Alerting viewpoints (minimum draft):

1. Unavailable spike: `auth_token_verify_unavailable_total` increases continuously for 5 minutes.
2. Cache degradation: cache hit ratio drops sharply from baseline while miss total rises.
3. WS reauth instability: reauth failure total rises above agreed baseline in 5-minute windows.

## 5. Failure scenarios and triage

### 5.1 Scenario A: JWKS retrieval failure

Symptoms:

- REST authentication responses shift to `503`
- WS closes with `1011`
- logs show `error_class=dependency_unavailable` and JWKS-related reason

Primary response:

1. Verify egress/DNS reachability for JWKS endpoint.
2. Confirm Firebase project/audience/issuer env values.
3. If outage persists, keep fail-close behavior and publish incident notice.

### 5.2 Scenario B: cache outage (Dragonfly or equivalent)

Symptoms:

- cache miss and cache error logs increase
- response latency may rise due to DB fallback

Primary response:

1. Confirm fallback to persistent mapping store is active.
2. Verify `403` behavior for unknown UID still holds.
3. Recover cache path and observe hit-ratio recovery.

### 5.3 Scenario C: principal store outage

Symptoms:

- REST/WS authentication fails as unavailable (`503` / `1011`)
- principal resolution failures spike

Primary response:

1. Check primary mapping data store health.
2. Restore store availability before retrying traffic shifts.
3. Confirm authentication allow path recovers with valid mapped UID.

## 6. Verification procedure

1. Valid token + mapped UID:
- REST protected endpoint returns `200`.
- WS handshake succeeds.

2. Invalid/expired token:
- REST returns `401`.
- WS denies or closes with `1008`.

3. Missing principal mapping:
- REST returns `403`.
- WS closes with `1008`.

4. Dependency unavailable simulation (JWKS/store):
- REST returns `503`.
- WS closes with `1011`.

5. Log and metrics checks:
- confirm `request_id` presence
- confirm `principal_id` appears on allow logs
- confirm metrics counters move for each scenario

## 7. Dependency boundary with downstream issues

- LIN-587 consumes principal mapping + WS reauth baseline.
- LIN-595 consumes authenticated principal contract for search API access control boundaries.
- LIN-596 consumes logging/metrics baseline as observability minimum.
- LIN-600 consumes authenticated principal boundary before AuthZ model work.

## 8. Password reset and auth-email delegation baseline (v1)

### 8.1 Responsibility boundary

- Password reset responsibility is delegated to Firebase standard capability.
- The application runtime must not update `users.password_hash` for reset handling.
- Legacy local reset token operation (`password_reset_tokens`) is out of runtime scope and must not be used as fallback.
- Authentication e-mail delivery for v1 defaults to Firebase-managed delivery; application-side SMTP/provider pipeline is not used.

### 8.2 Runtime behavior and API contract

- Backend does not provide a local password-reset execution endpoint.
- Requests to legacy local reset paths are treated as not provided by contract.
- REST/WS authentication behavior remains controlled by section 2 error mapping policy.

### 8.3 Failure handling policy for reset flow

- Reset initiation and mail delivery failures are handled on Firebase/client integration boundary, not by backend retry loops.
- Backend has no local reset retry worker or token fallback path.
- Operational triage during reset-related incidents:
  1. Check Firebase Auth service status and project configuration.
  2. Check client-side invocation errors and request traces.
  3. Confirm no local reset endpoint/path is reintroduced in backend releases.
