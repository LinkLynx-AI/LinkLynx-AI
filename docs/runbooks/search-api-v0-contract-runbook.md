# Search API v0 Contract Runbook

- Status: Draft
- Last updated: 2026-03-01
- Owner scope: Search API v0 baseline
- References:
  - `docs/adr/ADR-003-search-consistency-slo-reindex.md`
  - `docs/runbooks/search-v0-index-ingest-runbook.md`
  - `docs/runbooks/auth-firebase-principal-operations-runbook.md`
  - `LIN-595`

## 1. Purpose and scope

This runbook fixes the v0 Search API contract for guild/channel scoped keyword search.

In scope:

- Request/response contract
- Guild/channel filtering boundary
- v0 API-side authorization filtering policy
- Latency and failure-mode measurement viewpoints
- Operational triage guidance for query anomalies

Out of scope:

- SpiceDB integration implementation
- Ranking optimization and advanced query operators
- OpenSearch cluster operation details

## 2. Endpoint baseline

- Method: `GET`
- Path: `/api/v0/search/messages`

Authentication:

- Firebase-authenticated principal required.
- `principal_id` must be resolved before query execution.

## 3. Request contract

Required parameters:

- `q` (keyword, non-empty)
- `guild_id`

Optional parameters:

- `channel_id`
- `limit` (`1..50`, default `20`)
- `cursor`

Validation rules:

1. `guild_id` is mandatory for tenancy isolation.
2. `channel_id` without guild scope is invalid.
3. `limit` outside range is rejected.

## 4. Response contract

Success payload:

- `items[]`
- `next_cursor` (nullable)
- `has_more`
- `degraded` (boolean)

Each item includes:

- `message_id`
- `guild_id`
- `channel_id`
- `author_id`
- `snippet`
- `created_at`
- `score` (optional ranking score)

## 5. Authorization boundary (v0 fixed policy)

v0 baseline:

1. API resolves accessible channels for `principal_id` before search query execution.
2. Query is restricted to authorized `(guild_id, channel_id)` scope.
3. Results outside resolved scope must never be returned.

This policy remains API-side fail-close until dedicated AuthZ integration is introduced.

## 6. Performance viewpoint

Required metrics:

- `search_api_request_total`
- `search_api_error_total`
- `search_api_latency_ms` (`P50/P95/P99`)
- `search_api_timeout_total`
- `search_api_degraded_total`

v0 target viewpoint:

- `P95(search_api_latency_ms) <= 600ms` for `limit <= 20`

## 7. Failure and degraded response policy

## 7.1 OpenSearch unavailable

- Return degraded response with explicit `degraded=true` and empty or partial results according to safe policy.
- Do not return unauthorized fallback data.
- Emit incident signal when degraded windows exceed 10 minutes.

## 7.2 Auth/context resolution failure

- Fail-close and return authorization/dependency failure response.
- No best-effort partial scope execution is allowed.

## 7.3 Timeout and anomaly handling

- Enforce bounded timeout.
- Record timeout count and slow-query patterns.
- Recommend narrower scope (`channel_id`) for repeated wide-scope failures.

## 8. Query anomaly triage checklist

1. Verify auth scope resolution result size and correctness.
2. Verify query latency by scope size (`guild` only vs `guild+channel`).
3. Verify timeout distribution and hotspot channels.
4. Verify hit-rate anomalies for likely mapping or ingest lag issues.
5. Record mitigation decision (degraded continue vs temporary query restrictions).

## 9. Validation checklist

1. Input/output contract is explicit and machine-checkable.
2. Auth boundary prevents out-of-scope result leakage.
3. OpenSearch outage policy is defined without fail-open ambiguity.
4. Timeout/hit-rate anomaly triage can be executed from docs only.
