# Plan

## Rules
- Stop-and-fix: 検証またはレビューで失敗したら次工程へ進まず修正する。
- Scope lock: guild text channel の frontend 接続に限定し、DM や backend 契約拡張は行わない。

## Milestones
### M1: 実装前提の更新
- Acceptance criteria:
  - [ ] `Prompt.md` / `Plan.md` / `Implement.md` / `Documentation.md` を `LIN-829` 用に更新
  - [ ] 既存 message/chat/WS 導線の変更点を確定

### M2: message API/query 基盤
- Acceptance criteria:
  - [ ] message list/create 用型と query key を整理
  - [ ] `GuildChannelAPIClient` で guild message list/create が動く
  - [ ] cache merge helper を追加

### M3: chat UI / realtime 接続
- Acceptance criteria:
  - [ ] `ChatArea` / `MessageList` / `MessageInput` に guildId と paging/error 表示を配線
  - [ ] `WsAuthBridge` で active channel 購読と `message.created` cache 反映が動く

### M4: テストと収束
- Acceptance criteria:
  - [ ] API client / hook / WS/chat の回帰テストを更新
  - [ ] `make validate` と `cd typescript && npm run typecheck` を実行
  - [ ] 実装内容と意図を日本語で説明できる状態にする
