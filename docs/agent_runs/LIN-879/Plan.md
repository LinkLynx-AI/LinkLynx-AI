# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: 検証失敗時は次工程へ進まず修正する。
- Scope lock: LIN-879 の Do/Don't を逸脱しない。

## Milestones
### M1: Backend の delete API 追加
- Acceptance criteria:
  - [x] `DELETE /channels/{channel_id}` ルートを追加
  - [x] owner/admin manage 境界の認可を適用
  - [x] `403` / `404` / `503` 契約を既存 `GuildChannelError` で返す
- Validation:
  - `cd rust && cargo test -p linklynx_api guild_channel main::tests`

### M2: Frontend の削除導線接続
- Acceptance criteria:
  - [x] `GuildChannelAPIClient.deleteChannel` を実 API 化
  - [x] 右クリックメニューと編集画面から削除モーダルを開ける
  - [x] 削除成功時に channel cache と route を同期する
  - [x] 削除失敗時に明示的なエラーを表示する
- Validation:
  - `cd typescript && npm run test -- src/shared/api/guild-channel-api-client.test.ts src/widgets/channel-sidebar/ui/channel-item.test.tsx src/features/modals/ui/channel-edit-overview.test.tsx src/features/modals/ui/channel-delete-modal.test.tsx`
  - `cd typescript && npm run typecheck`

### M3: 統合検証とレビューゲート
- Acceptance criteria:
  - [x] `make rust-lint` が成功
  - [x] `cd typescript && npm run typecheck` が成功
  - [x] `make validate` を実行し結果を記録
  - [ ] reviewer / reviewer_ui_guard（必要時 reviewer_ui）の結果を記録
- Validation:
  - `make rust-lint`
  - `cd typescript && npm run typecheck`
  - `make validate`
