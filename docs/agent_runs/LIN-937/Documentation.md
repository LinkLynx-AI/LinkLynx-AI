# Documentation

## Current status
- Now: LIN-937 の message domain / adapter / apps/api 配線は実装済み
- Next: PR 向け説明を固める

## Decisions
- archived な LIN-846 / LIN-847 / LIN-851 の message 用最小断面は LIN-937 に内包する。
- Scylla `bucket` は UTC 日次 `YYYYMMDD` 整数で扱う。
- guild message create は request_id 単位の生成 ID キャッシュで同一プロセス内 retry を吸収する。

## How to run / demo
- `make db-up`
- `make scylla-bootstrap`
- `SCYLLA_HOSTS=127.0.0.1:9042 make rust-dev`
- `curl -sS http://127.0.0.1:8080/`
- `curl -i -sS http://127.0.0.1:8080/internal/scylla/health`
- `cd rust && cargo test -p linklynx_message_domain -p linklynx_platform_scylla_message -p linklynx_platform_postgres_message`
- `cd rust && cargo test -p linklynx_backend list_channel_messages`
- `cd rust && cargo test -p linklynx_backend create_channel_message`
- `make validate`

## Known issues / follow-ups
- 実 Scylla を使った広い append/list integration は LIN-938 で厚くする。
- edit / delete / reply metadata の書き込み拡張は後続 issue で扱う。
- request_id による create 冪等性は同一プロセス内キャッシュに留まる。複数 API instance 間での完全な冪等化には durable な request-id mapping か caller-supplied identity が必要で、この issue では扱わない。

## Review gate
- `reviewer`: cross-instance の request_id retry では同一 `message_id` を再利用できず、LIN-289 の duplicate no-op を API instance 間で完全には保証できない、という残リスク指摘あり。現実装は issue 合意スコープどおり同一プロセス内 retry の吸収に留める。
- `reviewer_ui_guard`: UI 変更なし。差分は `rust/` と `docs/agent_runs/LIN-937/` のみで、`typescript/src/**` や `typescript/public/**` に変更はないため UI review は skip。

## Runtime smoke
- `docker compose up -d postgres scylladb` と `make scylla-bootstrap` を実行し、local Postgres/Scylla を起動した。
- `set -a && source .env && set +a && cd rust && cargo run -p linklynx_backend` は sandbox 内では localhost bind/connect 制約で失敗したため、escalated で再実行した。最初の retry は `0.0.0.0:8080` が使用中で bind に失敗したが、listener 解放後の再試行で `Scylla runtime is ready` と `server starting address=0.0.0.0:8080` を確認した。
- `curl -i -sS http://127.0.0.1:8080/` は `200 OK` / `LinkLynx API Server` を返した。
- `curl -i -sS http://127.0.0.1:8080/internal/scylla/health` は `200 OK` / `{"service":"scylla","status":"ready"}` を返した。
- guild message create/list の live smoke は skip。ローカル DB に smoke 用 guild/channel/auth principal をこの issue では投入していないため、runtime 起動と dependency health までを確認対象とした。

## Validation log
- `cd rust && cargo test -p linklynx_message_domain -p linklynx_platform_scylla_message -p linklynx_platform_postgres_message -p linklynx_backend --no-run`: pass
- `cd rust && cargo test -p linklynx_message_domain`: pass
- `cd rust && cargo test -p linklynx_platform_scylla_message`: pass
- `cd rust && cargo test -p linklynx_platform_postgres_message`: pass
- `cd rust && cargo test -p linklynx_backend list_channel_messages`: pass
- `cd rust && cargo test -p linklynx_backend create_channel_message`: pass
- `make rust-lint`: pass（sandbox 外で再実行）
- `CI=true pnpm -C typescript install --frozen-lockfile`: pass
- `make validate`: pass
- `cd typescript && npm run typecheck`: pass
- `docker compose up -d postgres scylladb`: pass
- `make scylla-bootstrap`: pass
- `set -a && source .env && set +a && cd rust && cargo run -p linklynx_backend`: pass（sandbox では bind/connect 制約で失敗。escalated retry で `Scylla runtime is ready` と `server starting address=0.0.0.0:8080` を確認）
- `curl -i -sS http://127.0.0.1:8080/`: pass
- `curl -i -sS http://127.0.0.1:8080/internal/scylla/health`: pass
