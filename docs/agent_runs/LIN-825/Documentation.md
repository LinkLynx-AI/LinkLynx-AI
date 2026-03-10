# Documentation

## Current status
- Now: `LIN-825` の Rust 実装と runbook 更新まで完了。
- Next: PR 用に差分を整理し、review evidence を添えて提出する。

## Decisions
- `LIN-801` 親全体ではなく、1 issue = 1 PR に従ってこの run は `LIN-825` のみ実装する。
- delete は physical delete ではなく tombstone 更新で実装する。
- author 以外の edit/delete は usecase で拒否し、HTTP では `403 AUTHZ_DENIED` に変換する。
- `expectedVersion` は edit/delete request body の必須フィールドとする。
- `PATCH/DELETE /messages/{message_id}` の REST AuthZ action は `Manage` ではなく `Post` として扱い、author 制約は usecase 側で判定する。
- delete 成功時の public snapshot は tombstone として `content=""`、`is_deleted=true`、`version+1` を返す。
- Scylla の LWT update 応答は追加列を返しうるため、`(bool,)` ではなく dynamic row から先頭の `[applied]` 列だけを読む。

## How to run / demo
- `cd rust && cargo test -p linklynx_message_api`
- `cd rust && cargo test -p linklynx_message_domain`
- `cd rust && cargo test -p linklynx_platform_scylla_message`
- `cd rust && cargo test -p linklynx_backend edit_channel_message`
- `cd rust && cargo test -p linklynx_backend delete_channel_message`
- `make rust-lint`
- `cd typescript && npm run typecheck`

## Known issues / follow-ups
- WS fanout は `LIN-828` で実装する。
- FE mutation 接続とエラー回復は `LIN-831` で実装する。
- repo ルート `make message-scylla-integration` はローカルの Postgres/Scylla 起動が前提。未起動環境では接続拒否で失敗する。

## Validation evidence
- `cd rust && cargo test -p linklynx_message_api`: pass
- `cd rust && cargo test -p linklynx_message_domain`: pass
- `cd rust && cargo test -p linklynx_platform_scylla_message`: pass
- `cd rust && cargo test -p linklynx_backend edit_channel_message -- --nocapture`: pass
- `cd rust && cargo test -p linklynx_backend delete_channel_message -- --nocapture`: pass
- `cd rust && cargo test -p linklynx_backend channel_message -- --nocapture`: pass
- `cd rust && cargo test -p linklynx_backend message_scylla_integration_http_edit_channel_message_updates_live_storage -- --nocapture`: pass
- `cd rust && cargo test -p linklynx_backend message_scylla_integration_http_delete_channel_message_keeps_tombstone -- --nocapture`: pass
- `make message-scylla-integration`: fail
  - 修正箇所の 2 test 自体は pass
  - 現在の環境では `localhost:5432` Postgres と `127.0.0.1:9042` Scylla が未起動で、suite 全体は接続拒否で停止
- `make rust-lint`: pass
- `cd typescript && npm run typecheck`: pass
- `make validate`: fail
  - `typescript` format stepは通過
  - `python` format stepが PEP 668 の externally managed environment で停止し、dev tool 自動導入に失敗

## Review gate
- `reviewer`: agent 起動は行ったが、このセッションでは結果回収 API が使えず証跡未回収。
- `reviewer_ui_guard`: backend/runbook/memory 変更が中心で、今回の意図的な UI 変更はなし。UI review は不要判断。
