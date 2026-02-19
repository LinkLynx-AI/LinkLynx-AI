# LIN-139 Runtime Contracts (Search / PubSub / Redis)

This document defines runtime contracts that are required by the DB selection assumptions.
It is part of LIN-139 scope and must be implemented with the schema.

## 1. Search Contract

- Engine: Elastic Cloud on GCP (primary), OpenSearch on GKE (fallback).
- Index name: `messages`.
- Document id: `message_id`.
- Required fields:
  - `guild_id` (nullable for DM)
  - `channel_id`
  - `author_id`
  - `content`
  - `created_at`
  - `is_deleted`
  - `version`

### Version Guard Rule

- Update must be atomic.
- Reject stale events where incoming `version <= stored.version`.
- Read-compare-write in application code is prohibited.

### Example Mapping (minimum)

```json
{
  "mappings": {
    "properties": {
      "guild_id": { "type": "long" },
      "channel_id": { "type": "long" },
      "author_id": { "type": "long" },
      "content": { "type": "text" },
      "created_at": { "type": "date" },
      "is_deleted": { "type": "boolean" },
      "version": { "type": "long" }
    }
  }
}
```

## 2. Pub/Sub Contract

- Transport: GCP Pub/Sub with DLQ enabled.
- Ordering key: `channel:{channel_id}`.
- Event types: `MessageCreated`, `MessageUpdated`, `MessageDeleted`.

### Payload Schema

```json
{
  "event_id": "snowflake",
  "type": "MessageUpdated",
  "occurred_at": "2026-02-18T15:00:00Z",
  "ordering_key": "channel:456",
  "message": {
    "message_id": 123,
    "channel_id": 456,
    "guild_id": 789,
    "author_id": 111,
    "bucket": 999,
    "version": 2,
    "content": "edited text",
    "is_deleted": false
  }
}
```

### Delivery / Retry Rules

- Subscriber logic must be idempotent by `event_id` or `message_id + version`.
- DLQ retry flow must preserve ordering key.
- `MessageDeleted` must be indexed as tombstone (`is_deleted=true`).

## 3. Redis RateLimit L2 Contract

- L1: local node memory GCRA/TAT.
- L2: Redis fallback only when needed.
- Required keys:
  - `rl2:gcra:user:{user_id}:{action}`
  - `rl2:gcra:ip:{ip}:{action}`
- Value format: `tat_ms` as integer.
- TTL: few minutes (default 300 seconds).

### L2 Access Conditions

- near threshold boundary
- suspicious access pattern
- critical actions
- node restart or rebalance period
- L1 state cache miss
