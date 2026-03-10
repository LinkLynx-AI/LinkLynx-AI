# Documentation

## Current status
- Now: backend の `message.updated` / `message.deleted` WS fanout と、frontend query cache の consume まで実装し、backend/live integration と frontend validate を通した。
- Next: review evidence を確定して `LIN-828` を PR 化し、その後 `LIN-831` に進む。

## Decisions
- `LIN-828` は backend WS fanout に加えて、既存 websocket bridge の query cache consume まで含める。新しい inline edit/delete UI は `LIN-831` に送る。
- `MessageItemV1` を create/update/delete/list すべてで共通 snapshot とし、WS も同じ payload を配る。
- realtime hub は event 種別ごとに分岐するが、配送ロジックは共通 helper に集約する。
- frontend cache 側では `version` を比較し、順不同や重複配信で既存 snapshot を巻き戻さない。
- ignored の end-to-end WS test は既存の test harness 都合で `AUTHZ_DENIED` close を返すため、この issue では hub/unit test と live integration を主証跡に使う。

## How to run / demo
- `cd rust && cargo test -p linklynx_protocol_ws`
- `cd rust && cargo test -p linklynx_backend message_realtime_publish_ -- --nocapture`
- `cd rust && cargo test -p linklynx_backend channel_message_returns_ -- --nocapture`
- `make message-scylla-integration`
- `cd typescript && pnpm vitest run src/app/providers/ws-auth-bridge.test.tsx`
- `cd typescript && pnpm vitest run src/shared/api/message-query.test.ts src/features/context-menus/ui/message-context-menu.test.tsx`
- `cd typescript && npm run typecheck`
- `cd typescript && make validate`

## Known issues / follow-ups
- inline edit/delete の操作導線と conflict recovery UI は `LIN-831` で実装する必要がある。
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
- `cd typescript && pnpm vitest run src/app/providers/ws-auth-bridge.test.tsx`: pass
- `cd typescript && pnpm vitest run src/shared/api/message-query.test.ts src/features/context-menus/ui/message-context-menu.test.tsx`: pass
- `cd typescript && npm run typecheck`: pass
- `cd typescript && make validate`: pass

## Runtime smoke gate
- Skip。今回の変更は backend fanout と frontend cache 同期に限定され、primary route の起動成否よりも既存 integration test / frontend validate の方が直接的な回帰検知になるため。
- 代替証跡として live Scylla integration、WS contract test、frontend websocket bridge test を採用した。

## Review gate
- `reviewer_ui_guard`: pass（UI review required）
- `reviewer_ui`: spawn failed（agent thread limit）
- `reviewer`: spawn requested / result pending
