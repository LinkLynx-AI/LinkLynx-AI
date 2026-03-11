# LIN-921 Implement

## 2026-03-11

- 初期実装開始。
- DM realtime は新規 `dm.*` frame を追加して guild 用 `message.*` 契約を維持する方針。
- Rust backend で `dm.subscribe` / `dm.unsubscribe` / `dm.message.created` を追加し、DM create 成功時の realtime fanout を接続した。
- frontend `WsAuthBridge` を DM route 対応に拡張し、`dm.message.created` の cache 反映と reconnect 補償を追加した。
- `useMessages` の DM query key が send/realtime 側と不一致だったため `buildMessagesQueryKey(guildId, channelId)` に統一した。
