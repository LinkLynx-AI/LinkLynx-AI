# Documentation

## Current status
- Now: LIN-938 実装完了
- Next: PR 用説明へ転記

## Decisions
- live integration は colocated test として追加し、`rust/tests/**` はこの issue で新設しない。
- 自動化は duplicate no-op / paging edge / unavailable までに留める。
- read-before-retry は LIN-289 / LIN-291 に沿った手動検証手順で固定する。
- live 検証で実 Scylla の clustering key 制約に合わせる必要が判明したため、bucket 解決後の in-bucket paging 条件は `message_id` 比較に修正した。外部カーソル shape は `(created_at, message_id)` のまま維持する。
- live 検証で Postgres の `timestamptz` バインド不整合が判明したため、message metadata upsert / reservation SQL は `CAST($n AS text)::timestamptz` に揃えた。

## How to run / demo
- `make db-up`
- `make db-migrate`
- `make scylla-bootstrap`
- `make message-scylla-integration`
- `make rust-lint`
- `make validate`
- `make rust-dev`
- `make scylla-health`

## Validation / review evidence
- reviewer: blocking finding なし。追加対応として docs の cursor 説明を上位 runbook まで揃え、Postgres connect failure の live test を 1 本追加した。
- targeted live tests: `make message-scylla-integration` で `message_scylla_integration_*` 4 件が通過。
- Rust gate: `make rust-lint` 通過。
- full gate: `make validate` 通過。
- runtime smoke: `make rust-dev` 起動後に `make scylla-health` が `HTTP/1.1 200 OK` と `{"service":"scylla","status":"ready"}` を返すことを確認。

## Notes
- `make db-migrate` は既存ローカル DB が途中まで適用済みだったため再適用時に `relation "users" already exists` で停止した。破壊的リセットは行わず、必要テーブルの存在確認後にそのまま `make scylla-bootstrap` と integration test を進めた。
