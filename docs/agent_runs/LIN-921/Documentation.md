# LIN-921 Documentation

## Current status
- Now: backend/frontend の DM realtime 実装と対象回帰テスト追加まで反映済み。
- Next: reviewer/PR 用の説明へ validation 結果を転記する。

## Decisions
- DM realtime は加算拡張として別 WS frame を追加する。
- 既存 guild message REST/WS 契約は変更しない。
- DM の受信整合は `WS 即時反映 + reconnect/history 補償` で成立させる。
- DM route の active subscription は `/channels/me/{conversationId}` を直接解釈して解決する。
- DM snapshot の `guild_id = channel_id` 既存表現は今回維持する。

## Validation evidence
- `cd rust && cargo test -p linklynx_protocol_ws`: pass
- `cd rust && cargo test -p linklynx_backend parse_message_client_frame_extracts_dm_subscription_target -- --nocapture`: pass
- `cd rust && cargo test -p linklynx_backend build_message_server_frame_returns_dm_subscribed_ack -- --nocapture`: pass
- `cd rust && cargo test -p linklynx_backend dm_message_frame_access_allows_when_target_channel_is_allowed -- --nocapture`: pass
- `cd rust && cargo test -p linklynx_backend subscribe_dm_stores_principal_and_delivery_metadata -- --nocapture`: pass
- `cd rust && cargo test -p linklynx_backend ws_dm_message_created_fanout_reaches_subscribers -- --ignored --nocapture`: pass
- `cd rust && cargo test -p linklynx_backend --no-run`: pass
- `cd typescript && npm run typecheck`: pass
- `cd typescript && npx vitest run src/app/providers/ws-auth-bridge.test.tsx`: pass
- `make validate`: fail (`python` 配下で `No module named pip`。今回差分の TypeScript/Rust ではなく環境依存)
