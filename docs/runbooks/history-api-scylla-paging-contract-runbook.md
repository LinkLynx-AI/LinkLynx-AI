# History API Scylla Paging Contract Runbook (v0)

- Status: Draft
- Last updated: 2026-03-01
- Owner scope: History API v0 baseline
- References:
  - `database/scylla/queries/lin288_history_cursor_paging.cql`
  - `database/contracts/lin288_history_cursor_contract.md`
  - `database/contracts/lin289_idempotent_write_contract.md`
  - `docs/runbooks/message-persist-publish-dispatch-runbook.md`
  - `LIN-592`

## 1. Purpose and scope

This runbook fixes the v0 History API contract for Scylla-backed message paging.

In scope:

- Cursor format and ordering rules
- Initial/latest retrieval and older-page retrieval behavior
- Duplicate elimination policy
- Reconnect differential fetch policy (`last_seen` / `ack` boundary)
- Failure and retry behavior

Out of scope:

- UI rendering behavior
- Strong consistency guarantees
- Search API behavior

## 2. API contract baseline

## 2.1 Request parameters

Required:

- `channel_id`
- `limit` (`1..100`, default `50`)

Optional:

- `before` cursor for older-page fetch
- `after` cursor for forward differential fetch
- `last_seen_message_id` for reconnect catch-up boundary

## 2.2 Response payload

- `items[]` sorted by descending `(created_at, message_id)` in page payload
- `next_before` cursor for older page
- `next_after` cursor for forward continuation
- `has_more` boolean

Cursor payload must include both `created_at` and `message_id` to maintain deterministic ordering.

## 3. Paging and ordering rules

1. Initial fetch returns latest N messages.
2. Older-page fetch uses `before` cursor and returns strictly older items.
3. Differential fetch after reconnect uses `after` or `last_seen_message_id` boundary.
4. Ordering tie-break uses `message_id` when `created_at` collides.

## 4. Duplicate elimination policy

Server-side policy:

- Within one response page, duplicate `message_id` is prohibited.
- When boundary overlap can occur around cursor edges, server keeps latest unique entry.

Client-facing expectation:

- Consumers may still dedupe by `message_id` defensively across multiple page calls.

## 5. Reconnect differential fetch policy

On reconnect/resume fallback:

1. Client sends `last_seen_message_id` when available.
2. Server resolves boundary and returns messages newer than boundary.
3. If boundary is unknown or expired, server falls back to latest N + pagination guidance.
4. Missing realtime deliveries are compensated only through this history contract.

## 6. Performance viewpoint

Required measurements:

- `history_api_request_total`
- `history_api_error_total`
- `history_api_latency_ms` (`P50/P95/P99`)
- `history_page_size`

v0 target viewpoint:

- `P95(history_api_latency_ms) <= 500ms` for `limit <= 50` on normal channel load profile.

## 7. Failure and retry policy

Common failures:

- Scylla timeout/unavailable
- Invalid cursor
- Internal dependency timeout

Policy:

1. Invalid cursor -> client error with restart guidance.
2. Dependency timeout -> retryable server error with bounded retry recommendation.
3. Repeated dependency failure -> incident escalation and reconnect fallback messaging.

## 8. Operational troubleshooting checklist

1. Verify cursor decode success and boundary values.
2. Verify Scylla query path and index/partition assumptions.
3. Verify no duplicate `message_id` inside one response.
4. Verify latency distribution by channel skew profile.
5. Verify reconnect compensation path for a known missing message scenario.

## 9. Validation checklist

1. Initial, older-page, and reconnect differential flows are all defined.
2. Duplicate elimination policy is explicit and deterministic.
3. Error and retry guidance is explicit for timeout vs invalid cursor.
4. Measurement points can produce `P95` and error-rate trend for operations.
