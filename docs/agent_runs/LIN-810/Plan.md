# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: if validation fails, repair it before moving to the next step.

## Milestones
### M1: Issueスコープ確認と実API接続基盤の実装
- Acceptance criteria:
  - [x] LIN-810 の Do / Don't / AC を確認済み
  - [x] `server/channel` 一覧を取得する API client を実装済み
  - [x] `getAPIClient()` を実データ接続クライアントへ切り替え済み
- Validation:
  - `gh issue view 936 --json number,title,body,state,url`
  - `cd typescript && npm run fsd:check`
  - `cd typescript && npm run lint`

### M2: ルート同期と空状態UI実装
- Acceptance criteria:
  - [x] `/channels/{guildId}[/{channelId}]` から選択状態を抽出するルートパーサー追加
  - [x] Server rail / channel sidebar の active 同期実装
  - [x] loading/error/empty のプレースホルダ表示実装
  - [x] `/channels/[serverId]` で最初の text channel へ遷移し、空状態・エラー表示に対応
- Validation:
  - `cd typescript && npm run lint`
  - `cd typescript && npm run typecheck`

### M3: テスト追加・検証
- Acceptance criteria:
  - [x] ルートパーサーのテスト追加
  - [x] guild/channel API client のテスト追加
  - [x] `/channels/[serverId]` ページのテスト追加
- Validation:
  - `cd typescript && npm run test -- 'src/shared/api/guild-channel-api-client.test.ts' 'src/shared/config/routes.test.ts'`
  - `cd typescript && npm run typecheck`
  - `make rust-lint`

### M4: 横断バリデーション
- Acceptance criteria:
  - [ ] `make validate` が成功
  - [x] `make rust-lint` が成功
  - [x] `cd typescript && npm run typecheck` が成功
  - [x] Review gate を実施（sub-agentレビューで最終OK）
- Validation:
  - `make validate` (失敗: Node v22.4.0 + jsdom@27 の互換性問題により Vitest が `ERR_REQUIRE_ESM`)
  - `make rust-lint` (成功)
  - `cd typescript && npm run typecheck` (成功)
  - `spawn_agent(default)` code review（最終: `OK`）
  - `spawn_agent(default)` UI review（最終: `OK`）
