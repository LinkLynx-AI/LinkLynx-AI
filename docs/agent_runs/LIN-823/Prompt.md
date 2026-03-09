# Prompt

## Goals
- `LIN-823` として guild channel message の send/list API を live Scylla/Postgres 経由で成立させる。
- create -> list の往復と cursor paging 境界を HTTP レベルで固定し、後続の WS publish 実装へ接続できる状態にする。
- 検証とレビューの証跡を issue 専用の run memory に記録する。

## Non-goals
- DM API の実装。
- message edit/delete、WS publish、event schema の変更。
- 既存の message contract や error/status 契約の再設計。

## Deliverables
- guild message live integration helper の共通化。
- HTTP live integration test の追加。
- `docs/agent_runs/LIN-823/` の run memory 4 ファイル。

## Done when
- [ ] create 後に list で同一 message を確認できる。
- [ ] paging 境界の順序と cursor が HTTP レベルで固定される。
- [ ] `make message-scylla-integration` を含む必須検証が通る。
- [ ] review gate の blocking 指摘が 0。

## Constraints
- Perf: 既存の Scylla bucket paging と Postgres metadata 更新の流れを変えない。
- Security: 既存の AuthZ fail-close と protected route 境界を維持する。
- Compatibility: `LIN-821` / `LIN-948` の DTO、cursor、Idempotency-Key 契約を維持する。
