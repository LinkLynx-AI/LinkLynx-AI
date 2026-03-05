# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: 検証失敗時は次工程へ進まず修正する。
- Scope lock: LIN-878 の Do/Don't を逸脱しない。

## Milestones
### M1: Backend の patch API 追加
- Acceptance criteria:
  - [x] `PATCH /channels/{channel_id}` ルートを追加
  - [x] `name` パッチ入力を検証（空/型不正/上限超過）
  - [x] owner/admin のみ許可する判定を実装
- Validation:
  - `cd rust && cargo test -p linklynx_backend guild_channel`

### M2: Frontend の channel edit 接続
- Acceptance criteria:
  - [x] `GuildChannelAPIClient.updateChannel` を実 API 化
  - [x] `ChannelEditOverview` の保存を実 API に接続
  - [x] 成功時 close、失敗時エラー表示を実装
  - [x] `channels` / `channel` キャッシュを同期
- Validation:
  - `cd typescript && npm run test -- src/shared/api/guild-channel-api-client.test.ts src/features/modals/ui/channel-edit-overview.test.tsx src/widgets/channel-sidebar/ui/channel-item.test.tsx`
  - `cd typescript && npm run typecheck`

### M3: 統合検証とレビューゲート
- Acceptance criteria:
  - [x] `make rust-lint` が成功
  - [x] `cd typescript && npm run typecheck` が成功
  - [x] `make validate` を実行し結果を記録
  - [x] reviewer / reviewer_ui_guard（必要時 reviewer_ui）の結果を記録
- Validation:
  - `make rust-lint`
  - `cd typescript && npm run typecheck`
  - `make validate`
