# Prompt

## Goals
- Scylla message SoR と Postgres metadata を `domains/message` 経由で利用できるようにする。
- `apps/api` の guild message handler が direct CQL / fixture なしで append / list を呼べる状態にする。
- 後続の LIN-823 / LIN-914 / LIN-915 が transport 実装に集中できる最小基盤を作る。

## Non-goals
- DM message 実装。
- WS publish / dispatch。
- edit / delete / search / schema 破壊的変更。

## Deliverables
- `linklynx_message_domain` / `linklynx_platform_scylla_message` / `linklynx_platform_postgres_message` の追加。
- `apps/api` の message runtime/service 配線と guild message handler 差し替え。
- LIN-937 run memory と関連検証記録。

## Done when
- [ ] domain/usecase から Scylla append / list を呼び出せる。
- [ ] Postgres の message metadata 更新境界が明示されている。
- [ ] transport 層が direct CQL なしで send / list を組み込める。
- [ ] `make validate` と `make rust-lint` を通過している。

## Constraints
- Perf: Scylla paging は `limit + 1` と `(created_at, message_id)` の既存契約を維持する。
- Security: Scylla / Postgres 障害時は fail-open せず 503 系へ接続できること。
- Compatibility: message API / event / schema の additive-only 方針を守る。
