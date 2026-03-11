# Prompt

## Goals
- `LIN-825` として guild channel message の edit/delete command API を実装する。
- `version / edited_at / is_deleted` を更新できる backend 契約を固定する。
- `expectedVersion` 競合時の `409` と tombstone 整合を HTTP レベルで検証可能にする。

## Non-goals
- WS fanout と履歴再同期の実装。
- FE inline edit/delete 導線の接続。
- モデレーション権限や配信保証モデルの拡張。

## Deliverables
- message edit/delete request/response contract の追加。
- domain/usecase/service/store の command 実装。
- HTTP test と integration test の追加。
- `docs/agent_runs/LIN-825/` の run memory 4 ファイル。

## Done when
- [ ] edit API で `version` increment と `edited_at` 更新が成立する。
- [ ] delete API で tombstone (`is_deleted=true`) が残る。
- [ ] `expectedVersion` 不一致で `409` が返る。
- [ ] 権限不足の編集/削除が `403` で拒否される。

## Constraints
- Perf: 既存の Scylla bucket paging と create/list 動作を壊さない。
- Security: ADR-004 に従い fail-close を維持し、message author 以外の edit/delete を拒否する。
- Compatibility: ADR-001 に従い既存 create/list/WS contract を壊さず additive 変更のみ行う。
