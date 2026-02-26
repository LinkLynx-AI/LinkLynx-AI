# ADR-004 AuthZ Fail-Close Policy and Cache Strategy

- Status: Accepted
- Date: 2026-02-26
- Related:
  - [LIN-583](https://linear.app/linklynx-ai/issue/LIN-583)
  - [LIN-600](https://linear.app/linklynx-ai/issue/LIN-600)
  - [LIN-586](https://linear.app/linklynx-ai/issue/LIN-586)
  - [LIN-588](https://linear.app/linklynx-ai/issue/LIN-588)
  - [LIN-580](https://linear.app/linklynx-ai/issue/LIN-580)
- Prerequisite:
  - [ADR-001 Event Schema Compatibility Rules (Additive Changes Only)](./ADR-001-event-schema-compatibility.md)

## Context

LIN-583 requires a fixed authorization policy before v1 SpiceDB/AuthZ work proceeds.
Without a shared fail-close rule and cache contract, implementations may diverge across API and WS paths, causing inconsistent behavior during deny and dependency failure scenarios.
This ADR defines a single operational baseline for AuthZ checks with explicit error semantics, cache invalidation rules, and propagation SLO targets.

## Scope

- In scope:
  - Authorization decision policy for authenticated principals
  - API/WS response mapping for deny vs indeterminate outcomes
  - Authorization cache TTL/invalidation contract
  - Permission-change propagation SLO and observability requirements
- Out of scope:
  - SpiceDB deployment/implementation details
  - Database schema changes
  - Authentication failure behavior (owned by LIN-586)

## Decision

### 1. Fail-close baseline

- Authorization checks must be fail-close.
- If decision is indeterminate (`timeout`, `unavailable`, `internal error`), access must not be granted.
- `stale-if-error` is prohibited.
- AuthZ scope starts only after successful authentication.

### 2. API / WS response contract

#### 2.1 Deterministic deny

| Channel | Contract |
| --- | --- |
| REST | `403 Forbidden` |
| WS | Close code `1008` (policy violation) |
| App error code | `AUTHZ_DENIED` |

#### 2.2 Indeterminate decision (dependency failure)

| Channel | Contract |
| --- | --- |
| REST | `503 Service Unavailable` (recommend `Retry-After: 1`) |
| WS | Close code `1011` (internal error) |
| App error code | `AUTHZ_UNAVAILABLE` |

Rationale: deny and unavailable must be distinguishable for operational diagnosis while still preserving fail-close behavior.

### 3. Cache strategy (short TTL + invalidation events)

- Policy:
  - Positive decision TTL: `5s`
  - Negative decision TTL: `1s`
- Cache key:
  - `principal_id + resource_type + resource_id + action + policy_version`
- Invalidation triggers:
  - Role grant/revoke
  - Permission override changes
  - Policy version updates
- Invalidation behavior:
  - Immediately evict affected keys when invalidation event is received
  - Re-evaluate once TTL expires even without explicit invalidation
- Prohibited:
  - Fail-open fallback
  - Reuse of expired decisions
  - Operating without invalidation events as the primary model

### 4. Permission propagation SLO and measurement

- Target:
  - `P95 <= 3s`
  - `P99 <= 10s`
- Measurement window:
  - From permission-change commit timestamp
  - To first subsequent authorization check that reflects the new permission state
- Mandatory scenarios:
  - Grant
  - Revoke
  - Role replacement

### 5. Monitoring and logging requirements

#### 5.1 Required metrics

- `authz_check_total{result=allow|deny|indeterminate}`
- `authz_check_duration_ms`
- `authz_cache_hit_ratio`
- `authz_invalidation_lag_ms`

#### 5.2 Required log fields

- `request_id`
- `principal_id`
- `resource`
- `action`
- `decision`
- `decision_source`
- `error_class`

#### 5.3 Alerting viewpoints

- Sudden increase of `indeterminate` decisions
- `authz_invalidation_lag_ms` exceeding SLO-aligned thresholds
- Sharp drop in `authz_cache_hit_ratio`

### 6. Exception policy

- Explicitly public endpoints (for example, health checks) are outside AuthZ.
- All other endpoints/channels are fail-close by default.
- Adding a new exception requires explicit ADR update.
- Implicit/undocumented exceptions are prohibited.

## Public interface contract additions

1. REST authorization failure now distinguishes:
   - `403` for deterministic deny
   - `503` for indeterminate dependency failures
2. WS authorization failure now distinguishes:
   - `1008` for deterministic deny
   - `1011` for indeterminate dependency failures
3. Standard app-level error codes:
   - `AUTHZ_DENIED`
   - `AUTHZ_UNAVAILABLE`
4. Event-driven invalidation contract for authorization cache (key shape, TTL, invalidation triggers)

## How to test

1. Grant case:
   - Confirm access becomes allowed after permission grant.
   - Confirm propagation latency can be measured.
2. Revoke case:
   - Confirm access becomes denied after revoke.
   - Validate against `P95/P99` targets.
3. Role replacement case:
   - Confirm channel permission transitions match expected policy.
4. SpiceDB timeout case:
   - REST returns `503`, WS closes with `1011`.
5. Deterministic deny case:
   - REST returns `403`, WS closes with `1008`.
6. Stale cache protection case:
   - During dependency error, stale allow decision is not reused.
7. Observability case:
   - Required metrics and log fields are defined and reviewable.
8. Dependency reference case:
   - LIN-600 (v1 AuthZ model) can reference this ADR as prerequisite policy.

## Consequences

- v1 AuthZ design and implementation can proceed with one unambiguous fail-close contract.
- Runtime behavior is consistent across REST and WS in deny and dependency failure conditions.
- Permission-change propagation expectations become measurable and operable.
