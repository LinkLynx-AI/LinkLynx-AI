# Documentation

## Current status
- Now: backend で `message.updated` / `message.deleted` WS fanout を追加し、live integration まで通した。
- Next: review evidence を整え、次の `LIN-831` に必要な frontend consume 側の差分を洗う。

## Decisions
- `LIN-828` は backend WS fanout と snapshot 整合に限定し、FE UI 変更は `LIN-831` に送る。
- `MessageItemV1` を create/update/delete/list すべてで共通 snapshot とし、WS も同じ payload を配る。
- realtime hub は event 種別ごとに分岐するが、配送ロジックは共通 helper に集約する。
- ignored の end-to-end WS test は既存の test harness 都合で `AUTHZ_DENIED` close を返すため、この issue では hub/unit test と live integration を主証跡に使う。

## How to run / demo
- `cd rust && cargo test -p linklynx_protocol_ws`
- `cd rust && cargo test -p linklynx_backend message_realtime_publish_ -- --nocapture`
- `cd rust && cargo test -p linklynx_backend channel_message_returns_ -- --nocapture`
- `make message-scylla-integration`

## Known issues / follow-ups
- frontend cache 更新ロジックは `LIN-831` で `message.updated` / `message.deleted` を消費する必要がある。
- ignored の TCP bind WS test は harness 側の AuthZ close を返しており、別 issue でテスト基盤を分離した方がよい。

## Validation evidence
- `cd rust && cargo test -p linklynx_protocol_ws`: pass
- `cd rust && cargo test -p linklynx_backend message_realtime_publish_ -- --nocapture`: pass
- `cd rust && cargo test -p linklynx_backend channel_message_returns_ -- --nocapture`: pass
- `make db-reset`: pass
- `make db-migrate`: pass
- `make scylla-bootstrap`: pass
- `make message-scylla-integration`: pass
- `make rust-lint`: pass

## Review gate
- `reviewer_ui_guard`: pass（UI 変更なし）
- `reviewer`: running
