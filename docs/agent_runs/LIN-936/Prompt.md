# Prompt.md (Spec / Source of truth)

## Goals
- LIN-936 として API runtime から Scylla client を初期化できるようにする。
- Scylla の接続設定、起動時バリデーション、スキーマ適用手順、health probe を固定する。
- ローカル compose で再現できる bootstrap / verification 導線を追加する。

## Non-goals
- message send / list handler 実装。
- Scylla append/list adapter や cursor paging 実装。
- Postgres message metadata 更新責務の配線。
- WS / broker publish path の変更。

## Deliverables
- Backend: Scylla runtime config / health reporter / `/internal/scylla/health`。
- Ops: Scylla bootstrap / health 用の `Makefile` 導線と compose env。
- Docs: local runtime/bootstrap runbook。
- Evidence: validation / review / runtime smoke の記録。

## Done when
- [x] ローカル環境で API runtime が Scylla client を初期化できる。
- [x] `GET /health` の既存契約を壊さずに Scylla 詳細 health を確認できる。
- [x] Scylla schema apply 手順が明示コマンドで再現可能である。
- [x] unavailable / timeout / schema-missing の境界が ready/degraded/error で表現される。
- [x] `make validate` と `make rust-lint` が通る。

## Constraints
- Perf: message path 未実装のため軽量な health check に留める。
- Security: Scylla 障害時に fail-open な message path を導入しない。
- Compatibility: `GET /health` は `200 OK` + body `OK` を維持する。
