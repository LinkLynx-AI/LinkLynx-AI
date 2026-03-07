# Prompt

## Goals
- message REST / WS / durable event 契約を一意に固定し、LIN-823 / LIN-826 / LIN-914 の前提を確定する。
- cursor paging 契約を既存 LIN-288 資産に接続し、外部 I/F を opaque cursor + `before` / `after` で固定する。

## Non-goals
- Scylla 保存実装、WS fanout 実装、DM 実装、編集/削除 command 実装。
- 破壊的な event/schema 変更。

## Deliverables
- `linklynx_message_api` / `linklynx_protocol_ws` / `linklynx_protocol_events` の新規 contract crate。
- apps/api の message REST/WS stub を shared contract 参照へ差し替え。
- 関連 runbook と agent run memory の更新。

## Done when
- [ ] REST/WS/event の message 契約が Rust code 上で共有定義されている。
- [ ] cursor paging の boundary と validation がテストで固定されている。
- [ ] `make validate` / `make rust-lint` / `cd typescript && npm run typecheck` が通る。

## Constraints
- Perf: paging 契約は `limit + 1` と `(created_at, message_id)` の既存基準を崩さない。
- Security: AuthZ fail-close と既存 error contract（`VALIDATION_ERROR`, `AUTHZ_DENIED`, `AUTHZ_UNAVAILABLE`）を維持する。
- Compatibility: ADR-001 additive only を守り、unknown field を安全に無視できる shape を維持する。
