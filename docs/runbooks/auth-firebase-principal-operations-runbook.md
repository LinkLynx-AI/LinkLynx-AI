# Firebase Auth / principal_id Operations Runbook (Draft)

- Status: Draft
- Last updated: 2026-03-07
- Owner scope: v1 auth operations baseline for REST/WS shared authentication
- References:
  - [ADR-005 Dragonfly Outage RateLimit Failure Policy (Hybrid)](../adr/ADR-005-dragonfly-ratelimit-failure-policy.md)
  - [Edge REST/WS Routing and WS Drain Runbook](./edge-rest-ws-routing-drain-runbook.md)
  - [LIN-620](https://linear.app/linklynx-ai/issue/LIN-620)
  - [LIN-621](https://linear.app/linklynx-ai/issue/LIN-621)
  - [LIN-622](https://linear.app/linklynx-ai/issue/LIN-622)
  - [LIN-624](https://linear.app/linklynx-ai/issue/LIN-624)
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
- Initial authentication performs idempotent provisioning when mapping is missing.

### 2.2 WS browser handshake baseline

- `POST /auth/ws-ticket` issues short-lived one-time ticket for authenticated principal.
- `GET /ws` accepts unauthenticated upgrade and requires `auth.identify` within timeout.
- Identify contract:
  - Client -> Server: `{ \"type\": \"auth.identify\", \"d\": { \"method\": \"ticket\", \"ticket\": string } }`
  - Server -> Client: `{ \"type\": \"auth.ready\", \"d\": { \"principalId\": number } }`
- Compatibility paths:
  - `Authorization` header based WS handshake
  - `GET /ws?ticket=<ticket>` is disabled by default and may be re-enabled only by explicit runtime opt-in.
- Close behavior:
  - invalid/expired/replayed ticket, identify timeout, identify-before-ready violation -> `1008`
  - auth dependency unavailable -> `1011`

### 2.3 Error mapping policy

| failure class | REST | WS close code | app-level code |
| --- | --- | --- | --- |
| missing/invalid/expired token | `401` | `1008` | `AUTH_MISSING_TOKEN` / `AUTH_INVALID_TOKEN` / `AUTH_TOKEN_EXPIRED` |
| email not verified | `403` | `1008` | `AUTH_EMAIL_NOT_VERIFIED` |
| principal mapping missing/invalid | `403` | `1008` | `AUTH_PRINCIPAL_NOT_MAPPED` |
| auth dependency unavailable (JWKS/cache/store) | `503` | `1011` | `AUTH_UNAVAILABLE` |

### 2.4 WS token expiry and reauthentication

- On expiry during active WS session, server sends `auth.reauthenticate` request with deadline.
- Client must send `auth.reauthenticate` with `{ \"d\": { \"idToken\": string } }` before the deadline.
- While reauthentication is pending, application messages other than `auth.reauthenticate` are rejected and the session is closed with `1008` (`reauth_required`).
- If reauthentication fails or deadline passes, server closes with:
  - `1008` for deterministic auth failure
  - `1011` for dependency unavailability

### 2.5 Runtime configuration safety defaults

- `DATABASE_URL` is required for runtime principal mapping in normal operation.
- If `DATABASE_URL` is missing, principal resolution is fail-close by default (`AUTH_UNAVAILABLE`).
- Firebase issued-at skew tolerance is configurable via:
  - `FIREBASE_IAT_SKEW_SECONDS` (default: `60`)
- WS ticket and identify runtime knobs:
  - `WS_TICKET_TTL_SECONDS` (default: `60`)
  - `AUTH_IDENTIFY_TIMEOUT_SECONDS` (default: `5`)
  - `WS_TICKET_RATE_LIMIT_MAX_PER_MINUTE` (default: `20`)
  - `WS_IDENTIFY_RATE_LIMIT_MAX_PER_MINUTE` (default: `60`)
  - `AUTH_ATTEMPT_RATE_LIMIT_MAX_PER_MINUTE` (default: `20`)
  - `WS_ALLOWED_ORIGINS` (default: `http://localhost:3000,http://127.0.0.1:3000`)
  - `HTTP_ALLOWED_ORIGINS` (default: `http://localhost:3000,http://127.0.0.1:3000`)
  - `WS_QUERY_TICKET_ENABLED` (default: `false`)
  - `WS_PREAUTH_MESSAGE_MAX_BYTES` (default: `16384`)
  - `WS_PREAUTH_MAX_CONNECTIONS_PER_NODE` (default: `100`)
- Principal store retry behavior is configurable via:
  - `AUTH_PRINCIPAL_STORE_MAX_RETRIES` (default: `2`)
  - `AUTH_PRINCIPAL_STORE_RETRY_BASE_BACKOFF_MS` (default: `25`)
- Postgres transport is TLS-required by default.
  - Current implementation is fail-close when TLS is required and no TLS connector is configured.
  - Temporary plaintext opt-out is possible only with explicit:
    - `AUTH_ALLOW_POSTGRES_NOTLS=true` (local/development only)

### 2.6 Principal auto provisioning policy

- Trigger: first successful token verification with missing `uid -> principal_id` mapping.
- Provisioning behavior:
  - Validate required identity claims for user bootstrap (email required).
  - Create/reuse `users` row in Postgres.
  - Upsert `auth_identities` and re-resolve in the same logical flow.
- Concurrency safety:
  - Provisioning must be idempotent under duplicate/concurrent first-login requests.
  - Conflict-unresolved paths are fail-close (`403`).

### 2.7 Password reset / verification email responsibility

- Application runtime does not manage local password hashes or reset tokens.
- Password reset and verification emails are delegated to Firebase standard capabilities.
- Local fallback reset paths are prohibited.

### 2.8 Local reproduction contract (env / compose)

Required env contract for local auth runtime:

| target | required keys |
| --- | --- |
| backend (`rust`) | `FIREBASE_PROJECT_ID`, `DATABASE_URL`, `AUTH_ALLOW_POSTGRES_NOTLS` |
| frontend (`typescript`) | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` |

Fail-fast policy:

- Backend startup fails when required keys are missing.
- Backend startup fails when optional numeric/bool/url env values are set to invalid values.
- Frontend startup fails when required public Firebase keys are missing/invalid.
- `AUTH_ALLOW_POSTGRES_NOTLS` は `true` / `false` の明示値を推奨（`1/0` なども受理されるが、運用ドキュメント上は非推奨）。

Local steps (runbook-only reproducible flow):

1. Copy env templates.
   - `cp .env.example .env`
   - `cp rust/.env.example rust/.env`
   - `cp typescript/.env.example typescript/.env.local`
2. Set real Firebase test project values in `.env` and `typescript/.env.local` (never commit secrets).
   - For smoke verification, also set `AUTH_SMOKE_EMAIL` and `AUTH_SMOKE_PASSWORD` in `typescript/.env.local`.
3. Start local stack.
   - `docker compose up -d postgres`
   - `docker compose up -d rust typescript`
4. Verify startup.
   - `docker compose logs rust` should not contain env validation errors.
   - `docker compose logs typescript` should not contain frontend env validation errors.
5. Run smoke verification.
   - `cd typescript && npm run smoke:auth -- --mode=happy-path`
6. Verify auth path expectations.
   - `happy-path` must complete `Firebase login -> GET /protected/ping -> POST /auth/ws-ticket -> GET /ws + auth.identify`.
   - `GET /ws?ticket=<ticket>` is not part of the default browser baseline.
   - `protected/ping` success payload must include `request_id`, `principal_id`, `firebase_uid`.
   - `auth.ready` payload must include `principalId` and match the REST `principal_id`.
7. Validate missing/invalid token path separately when needed.
   - invalid token path still maps to `401/403/503` per section 2.3.

Operational note:

- The smoke script uses Firebase Identity Toolkit login and local backend endpoints directly.
- The script must not print ID tokens or WS tickets; only status, request IDs, and close codes are allowed in output.

## 3. Required logs and audit fields

Minimum required log fields on authentication decision paths:

- `request_id`
- `principal_id` (when resolved)
- `firebase_uid` (when available)
- `email_verified` (when available)
- `decision` (`allow` / `deny` / `unavailable`)
- `error_class` (for non-allow decisions)
- `reason`
- `provision_action` (`none` / `created` / `reused` / `conflict`)

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
- `auth_principal_provision_success_total`
- `auth_principal_provision_failure_total`
- `auth_principal_provision_retry_total`
- `auth_ws_reauth_success_total`
- `auth_ws_reauth_failure_total`

Alerting viewpoints (minimum draft):

1. Unavailable spike: `auth_token_verify_unavailable_total` increases continuously for 5 minutes.
2. Cache degradation: cache hit ratio drops sharply from baseline while miss total rises.
3. WS reauth instability: reauth failure total rises above agreed baseline in 5-minute windows.
4. Provisioning degradation: provisioning failure total rises while success total drops.

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

### 5.4 Scenario D: provisioning conflict spike

Symptoms:

- `AUTH_PRINCIPAL_NOT_MAPPED` with provisioning-conflict reason increases
- provisioning failure metric rises

Primary response:

1. Check unique constraint conflicts on `auth_identities` and `users(lower(email))`.
2. Verify duplicate/parallel login burst behavior from clients.
3. Keep fail-close response and resolve conflicting identity records operationally.

### 5.5 Scenario E: local smoke triage

This scenario is the default first triage path when `npm run smoke:auth` fails locally.

1. Firebase login step fails:
   - Confirm `NEXT_PUBLIC_FIREBASE_API_KEY`, `AUTH_SMOKE_EMAIL`, and `AUTH_SMOKE_PASSWORD` in `typescript/.env.local`.
   - Confirm the smoke user exists in the Firebase test project and the password is current.
2. `protected/ping` fails with `401` or `403`:
   - Confirm the smoke user is `emailVerified=true`.
   - Confirm backend auth logs include the same `firebase_uid` and an expected `request_id`.
3. `protected/ping` fails with `503` unexpectedly:
   - Check backend startup logs for `DATABASE_URL`, JWKS, or AuthZ provider initialization failures.
   - If `AUTHZ_PROVIDER=spicedb`, verify SpiceDB health before treating it as AuthN failure.
4. `ws-ticket` issuance fails:
   - Confirm the same ID token succeeds on `protected/ping`.
   - Confirm the backend returns an auth code (`AUTH_*`) instead of transport errors.
5. `/ws + auth.identify` fails:
   - Confirm `WS_ALLOWED_ORIGINS` includes the local frontend origin.
   - Distinguish deterministic close (`1008`) from dependency unavailable (`1011`) before escalating.

## 6. Verification procedure

1. Valid token + mapped UID:
- REST protected endpoint returns `200`.
- WS handshake succeeds.
- `cd typescript && npm run smoke:auth -- --mode=happy-path` passes.

2. Invalid/expired token:
- REST returns `401`.
- WS denies or closes with `1008`.

3. Missing principal mapping on first authentication:
- REST returns `200` when provisioning succeeds.
- REST returns `403` when conflict is unrecoverable.
- WS follows equivalent allow/deny behavior.

4. AuthZ provider unavailable simulation (local smoke):
- REST returns `503`.
- WS closes with `1011`.
- For local AuthZ outage verification, use the AuthZ SpiceDB runbook and run:
  - `cd typescript && npm run smoke:auth -- --mode=dependency-unavailable`

Operational note:

- `dependency-unavailable` mode verifies the AuthZ provider outage path (`AUTHZ_UNAVAILABLE`) only.
- AuthN dependency outages such as JWKS or principal store failures remain manual verification scenarios in section 5.

5. Unverified email token:
- REST returns `403` with `AUTH_EMAIL_NOT_VERIFIED`.
- WS closes with `1008`.

6. Log and metrics checks:
- confirm `request_id` presence
- confirm `principal_id` appears on allow logs
- confirm metrics counters move for each scenario

## 7. Dependency boundary with downstream issues

- LIN-587 consumes principal mapping + WS reauth baseline.
- LIN-595 consumes authenticated principal contract for search API access control boundaries.
- LIN-596 consumes logging/metrics baseline as observability minimum.
- LIN-600 consumes authenticated principal boundary before AuthZ model work.
