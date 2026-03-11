# LIN-948 guild message create durable idempotency contract

## Purpose

- Target issue: `LIN-948`
- Introduce caller-supplied durable idempotency for `POST /v1/guilds/{guild_id}/channels/{channel_id}/messages`.
- Reuse fixed `message_id` / `created_at` across API instances and retries.

Out of scope:

- DM message create
- edit / delete / WS publish / search
- changing existing message response shape

## Table contract

Table: `message_create_idempotency_keys`

- Primary key: `(principal_id, channel_id, idempotency_key)`
- Foreign keys:
  - `principal_id -> users(id) ON DELETE CASCADE`
  - `channel_id -> channels(id) ON DELETE CASCADE`
- Required columns:
  - `payload_fingerprint`
  - `state` (`reserved` or `completed`)
  - `message_id`
  - `message_created_at`
  - `completed_at`
  - `created_at`
  - `updated_at`

## Behavior contract

1. `Idempotency-Key` absent:
   - treat request as a normal non-idempotent create
   - do not use `request_id` as fallback idempotency identity
2. New `(principal_id, channel_id, idempotency_key)`:
   - create a `reserved` row with generated `message_id` / `message_created_at`
3. Same key + same payload:
   - reuse stored `message_id` / `message_created_at`
   - if row is `reserved`, retry Scylla append and metadata upsert with the stored identity
   - if row is `completed`, return the same response identity without creating a new row
4. Same key + different payload:
   - reject deterministically with validation error

## Ordering contract

1. Reserve durable key in Postgres
2. Append to Scylla with fixed `message_id` / `message_created_at`
3. Upsert `channel_last_message`
4. Mark reservation as `completed`

If step 4 fails, the request is treated as failed and a later retry must safely resume from the `reserved` row.

## Compatibility

- REST success payload remains `201 Created` with the existing `message.message_id`, `created_at`, and other fields unchanged.
- This contract is additive to current Postgres schema and does not alter existing Scylla write semantics.
