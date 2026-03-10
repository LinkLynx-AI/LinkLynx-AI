# Prompt

## Goals
- guild message create に `Idempotency-Key` ベースの durable idempotency を導入する。
- same key + same payload で API instance を跨いでも同じ `message_id` / `created_at` を返す。
- same key + different payload を deterministic な validation error として拒否する。

## Non-goals
- DM / edit / delete / WS publish / search の拡張。
- 既存 message response shape の破壊的変更。

## Deliverables
- Postgres migration / repository / usecase / handler / docs / tests。
- `request_id` 依存の一時キャッシュ撤去。
- LIN-948 run memory と検証ログ。

## Done when
- [x] durable reservation table が追加されている
- [x] same key + same payload で identity reuse
- [x] same key + different payload で validation error
- [x] `make rust-lint` と `make validate` が通る

## Constraints
- Perf: 既存 Scylla append/list hot path を不必要に複雑化しない。
- Security: Postgres / Scylla 障害時は fail-close を維持する。
- Compatibility: create endpoint の success payload と status は維持する。
