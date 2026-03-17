# AuthZ noop allow-all Exception and SpiceDB Handoff Runbook

- Status: Draft
- Last updated: 2026-03-13
- Owner scope: v1 pre-release AuthZ exception management and SpiceDB cutover handoff
- References:
  - [ADR-004 AuthZ Fail-Close Policy and Cache Strategy](../adr/ADR-004-authz-fail-close-and-cache-strategy.md)
  - [AuthZ Contract (LIN-600)](../AUTHZ.md)
  - [LIN-602](https://linear.app/linklynx-ai/issue/LIN-602)
  - [LIN-629](https://linear.app/linklynx-ai/issue/LIN-629)

## 1. Purpose and scope

This runbook defines one temporary operations baseline for `noop allow-all` during the v1 non-release period and fixes the handoff conditions for SpiceDB migration.

In scope:
- `AUTHZ_ALLOW_ALL_UNTIL` exception expiry control
- Monitoring and operational decision points while allow-all is active
- SpiceDB cutover acceptance checks and rollback baseline

Out of scope:
- SpiceDB implementation details
- Full cache layer implementation and tuning
- AuthN behavior policy changes

## 2. Temporary exception contract

### 2.1 Runtime defaults

- `AUTHZ_PROVIDER` unset / empty / unknown => fail-close (`AUTHZ_UNAVAILABLE`)
- `AUTHZ_PROVIDER=noop` enables the temporary allow-all exception only when explicitly set
- `AUTHZ_ALLOW_ALL_UNTIL=2026-06-30` (UTC date baseline for explicit `noop`)
- `AUTHZ_PROVIDER=spicedb` uses active SpiceDB authorizer path and fail-close semantics.
- implicit fallback from `spicedb` to `noop allow-all` is prohibited.
- if `AUTHZ_PROVIDER=noop` and `AUTHZ_ALLOW_ALL_UNTIL` is invalid or earlier than the current UTC date, runtime must fail-close.

### 2.2 Risk statement

- `noop allow-all` is a fail-open exception against ADR-004 fail-close baseline.
- This exception is permitted only in v1 non-release period.
- Production release with allow-all active is prohibited.
- Runtime expiry enforcement is mandatory; on and after **2026-07-01 UTC**, the baseline `2026-06-30` date must no longer activate `noop` unless a dated extension is recorded.

### 2.3 Required TODO and code boundary

- noop authorizer function must contain explicit TODO for SpiceDB replacement.
- Authorization DB query logic must not be added in this phase.
- All authorization hooks must route through the `Authorizer` boundary.

## 3. Expiry policy and operational decision points

### 3.1 Expiry date

- Baseline expiry: **2026-06-30 (UTC)**.

### 3.2 Daily/CI checks while exception is active

1. Confirm runtime logs include:
- `AUTHZ_PROVIDER`
- `AUTHZ_ALLOW_ALL_UNTIL`
- decision logs on deny/unavailable paths (`request_id`, `principal_id`, `resource`, `action`, `decision`, `error_class`)

2. Confirm release gate check (required before release):
- Run `printenv AUTHZ_PROVIDER` on release environment and confirm value is **not** `noop`.
- If value is `noop`, release must be blocked and incident ticket opened.

3. Confirm contract tests still pin:
- REST deny mapping (`403`, `AUTHZ_DENIED`)
- REST unavailable mapping (`503`, `AUTHZ_UNAVAILABLE`)
- WS deny/unavailable close mapping (`1008` / `1011`)

4. Confirm there is no direct authorization logic bypassing `Authorizer`.

### 3.3 Decision points

- T-30 days to expiry (2026-05-31 UTC):
  - open/confirm SpiceDB implementation issue is active
  - assign cutover owner and rollback owner
- T-7 days to expiry (2026-06-23 UTC):
  - complete cutover rehearsal in staging
  - verify rollback procedure and metrics/dashboard readiness
- Expiry day (2026-06-30 UTC):
  - if SpiceDB is not ready, explicitly approve and record a dated extension decision
  - extension without recorded owner/expiry is prohibited
  - record location (single source): Linear issue comment on `LIN-629` with new expiry date, owner, and rollback condition

## 4. SpiceDB cutover acceptance criteria

Cutover readiness requires all items:
- `AUTHZ_PROVIDER=spicedb` path returns deterministic deny/unavailable mapping per ADR-004.
- Noop allow-all path is disabled in release configuration.
- CI can detect SpiceDB path regressions via Rust tests (`make rust-lint`).
- CI job `AuthZ SpiceDB Regression` runs focused provider/REST-path regressions.
- Observability fields exist on AuthZ deny/unavailable paths:
  - `request_id`, `principal_id`, `resource`, `action`, `decision`, `decision_source`, `error_class`
- Metrics endpoint exposes decision counters:
  - `GET /internal/authz/metrics` -> `allow_total`, `deny_total`, `unavailable_total`
  - access requires `x-linklynx-internal-shared-secret`; bearer token only is insufficient
- Validation gates pass:
  - `cd rust && cargo test -p linklynx_backend --locked`
  - `make rust-lint`
  - `make validate`

## 5. Cutover procedure (high level)

1. Freeze AuthZ-related config changes.
2. Deploy SpiceDB-capable build to staging.
3. Switch staging `AUTHZ_PROVIDER` from `noop` to `spicedb`.
4. Execute dry-run checks:
  - allow path: protected REST endpoint returns `2xx`
  - deny path: protected REST endpoint returns `403` (`AUTHZ_DENIED`)
  - unavailable path: stop SpiceDB and confirm REST `503` / WS `1011`
5. Verify observability:
  - logs include required decision fields
  - `GET /internal/authz/metrics` counters increase in expected buckets
  - use the internal shared secret header when querying the metrics endpoint
6. Roll forward to production only after staged acceptance pass.

## 6. Rollback procedure

Rollback trigger examples:
- spike of `AUTHZ_UNAVAILABLE`
- deterministic deny path mismatch
- severe false deny/allow behavior

Rollback steps:
1. Switch `AUTHZ_PROVIDER` back to `noop`.
2. Re-run smoke checks:
  - protected REST baseline succeeds for known test principal
  - WS handshake/reauth baseline succeeds
3. Confirm `unavailable_total` increase has stopped and error logs stabilized.
4. Record incident, owner, and follow-up action with target date.

## 7. Observability minimum

During exception and cutover windows, monitor at minimum:
- request-level authz reject logs with required fields
- decision counters from `GET /internal/authz/metrics`
  - `allow_total`
  - `deny_total`
  - `unavailable_total`
  - query path is guarded by `x-linklynx-internal-shared-secret`
- ws close code distribution (`1008`, `1011`)

Alert viewpoints:
1. sudden increase of `unavailable_total` growth rate
2. mismatch between expected deny and observed unavailable
3. handshake/reauth close-code mismatch in WS logs

## 8. Exit criteria for this exception

All items must be true:
- SpiceDB path is production-ready and validated
- noop allow-all is removed from release path
- extension records are closed
- runbook is updated from Draft to active baseline for post-noop operations
