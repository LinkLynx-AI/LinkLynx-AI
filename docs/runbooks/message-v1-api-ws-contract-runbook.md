# Message v1 API/WS Contract Runbook

- Status: Active with tracked v1 follow-up items
- Last updated: 2026-03-13
- Owner scope: v1 message contract baseline
- v1 follow-up owner:
  - Runtime/API: Backend team
  - WS/Fanout: Realtime team
  - Docs/Tracking: Platform docs owner
- Next target date: 2026-04-15
- References:
  - `docs/adr/ADR-001-event-schema-compatibility.md`
  - `docs/adr/ADR-002-class-ab-event-classification-and-delivery-boundary.md`
  - `docs/adr/ADR-004-authz-fail-close-and-cache-strategy.md`
  - `database/contracts/lin288_history_cursor_contract.md`
  - `rust/crates/contracts/message-api/src/lib.rs`
  - `rust/crates/contracts/protocol-ws/src/lib.rs`
  - `rust/crates/contracts/protocol-events/src/lib.rs`
  - `LIN-821`

## 1. Purpose and scope

This runbook fixes the v1 baseline for text message REST/WS contracts before storage and fanout are wired.

In scope:

- guild text channel message REST command/list contract
- DM message REST command/list contract
- opaque cursor paging contract
- guild WS subscribe/unsubscribe and message.created/message.updated/message.deleted frame contract
- DM WS subscribe/unsubscribe and dm.message.created frame contract
- durable event naming and payload baseline for message create

Out of scope:

- message send over WS
- Scylla persistence wiring
- edit/delete command contract
- durable event transport for edit/delete

## 1.1 Delivery gate boundary

This document contains both:

- current v1 baseline that is required for the present delivery gate, and
- tracked follow-up items that are explicitly excluded from blocking current v1 delivery.

Current v1 delivery is considered satisfied when the create/list REST contract, current WS subscription/fanout baseline, and `message_create` durable event contract are implemented and validated.

The following items are tracked as follow-up and are not blockers for current v1 delivery:

- edit/delete REST command contract rollout
- durable event transport for edit/delete
- tombstone fanout hardening beyond the current snapshot compatibility baseline

Promotion of any follow-up item into the delivery gate requires a separate issue update and traceability update.

## 1.2 Tracked v1 follow-up items

| item | current state | owner | next target date | entry condition |
| --- | --- | --- | --- | --- |
| Edit command contract rollout | tracked follow-up | Backend team | 2026-04-15 | optimistic concurrency and authz/audit impact review is assigned |
| Delete/tombstone contract rollout | tracked follow-up | Backend team | 2026-04-15 | tombstone visibility and client compatibility review is assigned |
| Durable event transport for edit/delete | tracked follow-up | Realtime team | 2026-04-15 | additive event catalog extension plan is approved |

Security / audit notes for the follow-up items:

- edited/deleted snapshots must preserve author ownership checks and fail-close authz behavior.
- tombstone visibility must not leak content after delete; clients must render from `is_deleted` rather than stale content caches.
- edit/delete event transport must remain additive under ADR-001 and keep class/delivery boundaries aligned with ADR-002.

## 2. REST contract baseline

### 2.1 List endpoint

- Method: `GET`
- Path: `/v1/guilds/{guild_id}/channels/{channel_id}/messages`

Query parameters:

- `limit` (`1..100`, default `50`)
- `before` opaque cursor for older-page fetch
- `after` opaque cursor for newer-page fetch

Rules:

1. `before` and `after` must not be used together.
2. External cursor payload remains `(created_at, message_id)`.
3. Storage-layer boundary checks resolve the bucket from `created_at` and apply strict in-bucket paging with `message_id`.
4. External cursor value is opaque; clients must not inspect or construct it manually.

Success payload:

- `items[]`
- `next_before` (nullable)
- `next_after` (nullable)
- `has_more`

Ordering:

1. Initial fetch and `before` fetch return newest -> oldest.
2. `after` fetch returns oldest -> newest.
3. Duplicate `message_id` across a page boundary is prohibited.

### 2.2 Create endpoint

- Method: `POST`
- Path: `/v1/guilds/{guild_id}/channels/{channel_id}/messages`

Request payload:

- `content`

Optional request headers:

- `Idempotency-Key`

Success payload:

- `message`

Validation baseline:

1. blank-only `content` is rejected.
2. blank / invalid `Idempotency-Key` is rejected.
3. same `Idempotency-Key` + different payload is rejected as `VALIDATION_ERROR`.
4. Error transport remains existing `VALIDATION_ERROR` / `AUTHZ_DENIED` / `AUTHZ_UNAVAILABLE`.

Validation reason baseline:

- blank / invalid `Idempotency-Key`: `message_idempotency_key_invalid`
- same `Idempotency-Key` + different payload: `message_idempotency_payload_mismatch`
- missing / cross-guild channel: `message_channel_not_found`

Idempotency baseline:

1. `Idempotency-Key` is optional and caller opt-in.
2. same key + same payload reuses the same `message_id` / `created_at` across retries.
3. replay success still returns `201 Created`.
4. idempotency repository / Postgres unavailable is handled fail-close as dependency unavailable.

Troubleshooting baseline:

- If retries with the same `Idempotency-Key` stop reusing `message_id`, first verify that the request payload canonicalizes to the same fingerprint and that the caller is not mutating `content`.
- If create starts returning dependency unavailable during replay, inspect API logs for `message create idempotency reservation failed` or `message create idempotency completion failed` and confirm Postgres connectivity before retrying.
- If replay remains stuck behind partial failure, prefer resending the same payload with the same `Idempotency-Key`; the reservation is designed to reuse the fixed identity once Postgres recovers.

### 2.3 Edit endpoint

- Method: `PATCH`
- Path: `/v1/guilds/{guild_id}/channels/{channel_id}/messages/{message_id}`

Request payload:

- `content`
- `expected_version`

Success payload:

- `message`

Rules:

1. `content` blank-only is rejected.
2. `expected_version` is required and must be positive.
3. caller must be the original `author_id`; otherwise return `AUTHZ_DENIED`.
4. if stored `version != expected_version`, return `409` with conflict transport.
5. deleted messages are not editable and return conflict transport.

### 2.4 Delete endpoint

- Method: `DELETE`
- Path: `/v1/guilds/{guild_id}/channels/{channel_id}/messages/{message_id}`

Request payload:

- `expected_version`

Success payload:

- `message`

Rules:

1. physical delete is prohibited; update the row as tombstone.
2. success response keeps the same `message_id` / `created_at` and flips `is_deleted=true`.
3. tombstone response clears `content` and increments `version`.
4. caller must be the original `author_id`; otherwise return `AUTHZ_DENIED`.
5. if stored `version != expected_version`, return `409` with conflict transport.

## 3. Shared message snapshot

`MessageItemV1` fields:

- `message_id`
- `guild_id`
- `channel_id`
- `author_id`
- `content`
- `created_at`
- `version`
- `edited_at`
- `is_deleted`

Compatibility rules:

1. New fields must be additive only.
2. Consumers must ignore unknown fields safely.
3. `edited_at` defaults to `null`, `is_deleted` defaults to `false` when omitted by older payloads.
4. tombstone snapshots remain list-compatible; clients must prefer `is_deleted` over `content` visibility.

## 4. WS contract baseline

Client frames:

- `message.subscribe`
- `message.unsubscribe`
- `dm.subscribe`
- `dm.unsubscribe`

Server frames:

- `message.subscribed`
- `message.unsubscribed`
- `message.created`
- `message.updated`
- `message.deleted`
- `dm.subscribed`
- `dm.unsubscribed`
- `dm.message.created`

Payload baseline:

1. Subscribe/unsubscribe target is `(guild_id, channel_id)`.
2. `message.created` / `message.updated` / `message.deleted` each carry `guild_id`, `channel_id`, and a full `MessageItemV1` snapshot.
3. DM subscribe/unsubscribe target is `channel_id`.
4. `dm.message.created` carries `channel_id` and a full `MessageItemV1` snapshot.
5. edit/delete fanout must publish the same snapshot shape returned by REST and list APIs.
6. clients must treat `message.deleted` as tombstone state and prefer `is_deleted` over `content`.
7. AuthN/AuthZ failure handling is unchanged from ADR-004 driven runtime behavior.

## 5. Durable event baseline

- Catalog name: `message_create`
- Payload `type`: `MessageCreated`
- Ordering key: `channel:{channel_id}`
- Class: `Class A`

Required payload fields:

- `event_id`
- `occurred_at`
- `ordering_key`
- `message.message_id`
- `message.guild_id`
- `message.channel_id`
- `message.author_id`
- `message.content`
- `message.created_at`
- `message.version`

Notes:

1. WS frame name `message.created` is not the durable event name.
2. Durable event transport for edit/delete remains out of scope in v1 baseline until a follow-up issue extends the catalog additively.
3. REST edit/delete command rollout must not break existing create/list/WS consumers.

## 6. Validation checklist

1. REST list/create/edit/delete, DM list/create, WS frames, and durable event share the same `MessageItemV1`.
2. Cursor round-trip and invalid-cursor rejection are test-covered.
3. `message_create` class is aligned with ADR-002.
4. edit/delete conflict and tombstone behavior are test-covered.
5. `message.updated` / `message.deleted` fanout uses the same latest snapshot shape as list/edit/delete responses.
6. Unknown future fields do not break deserialization.
7. DM subscribe ACK and `dm.message.created` fanout are test-covered.

## 7. Follow-up tracking notes

- Current v1 delivery gate excludes the tracked follow-up items in section 1.2.
- When a follow-up starts, update this runbook, `docs/V1_TRACEABILITY.md`, and the corresponding `docs/agent_runs/LIN-*` together.
- Do not delete the follow-up rows until the replacement issue/PR and rollout evidence are linked.
