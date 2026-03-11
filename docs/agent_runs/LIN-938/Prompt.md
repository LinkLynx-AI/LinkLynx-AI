# Prompt

## Goals
- 実 Scylla を使う message append/list の統合テストを追加する。
- idempotent write / cursor paging / unavailable 系の回帰を自動検知できるようにする。
- ローカルで再現可能な検証手順とコマンドを runbook に整備する。

## Non-goals
- UI / E2E の追加
- WS fanout / broker 検証の混在
- DB schema / event contract の変更
- read-before-retry の完全自動化

## Deliverables
- env-gated な Rust live integration tests
- `make message-scylla-integration`
- CI の Scylla integration 実行経路
- LIN-289 / LIN-291 と整合するローカル検証手順

## Done when
- [ ] 実 Scylla 前提の integration test が追加されている
- [ ] duplicate no-op / paging edge / unavailable が自動検知される
- [ ] ローカル再現コマンドが docs に固定されている
- [ ] `make rust-lint` と `make validate` が通る

## Constraints
- Perf: paging contract の `limit + 1` と ordering を壊さない
- Security: unavailable は fail-close を維持する
- Compatibility: additive only。既存 REST / DB / CQL contract は変更しない
