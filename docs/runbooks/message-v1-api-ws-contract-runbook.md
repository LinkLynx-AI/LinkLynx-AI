# Message v1 API/WS Contract Runbook

- Status: Draft
- Last updated: 2026-03-07
- Owner scope: v1 message contract baseline
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

- guild text channel message REST contract
- opaque cursor paging contract
- WS subscribe/unsubscribe and message.created frame contract
- durable event naming and payload baseline for message create

Out of scope:

- DM transport contract
- message send over WS
- Scylla persistence wiring
- edit/delete command contract

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
2. Cursor compare key remains `(created_at, message_id)`.
3. External cursor value is opaque; clients must not inspect or construct it manually.

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

Success payload:

- `message`

Validation baseline:

1. blank-only `content` is rejected.
2. Error transport remains existing `VALIDATION_ERROR` / `AUTHZ_DENIED` / `AUTHZ_UNAVAILABLE`.

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

## 4. WS contract baseline

Client frames:

- `message.subscribe`
- `message.unsubscribe`

Server frames:

- `message.subscribed`
- `message.unsubscribed`
- `message.created`

Payload baseline:

1. Subscribe/unsubscribe target is `(guild_id, channel_id)`.
2. `message.created` carries `guild_id`, `channel_id`, and a full `MessageItemV1` snapshot.
3. AuthN/AuthZ failure handling is unchanged from ADR-004 driven runtime behavior.

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
2. Future edit/delete events must be additive extensions in later issues.

## 6. Validation checklist

1. REST list/create, WS frames, and durable event share the same `MessageItemV1`.
2. Cursor round-trip and invalid-cursor rejection are test-covered.
3. `message_create` class is aligned with ADR-002.
4. Unknown future fields do not break deserialization.
