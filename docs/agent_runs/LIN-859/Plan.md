# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: if validation fails, repair it before moving to the next step.

## Milestones
### M1: 前提同期と API create 実装
- Acceptance criteria:
  - [x] `origin/main`（LIN-810 含む）を取り込み済み
  - [x] `GuildChannelAPIClient` に `createServer` / `createChannel` を実装
  - [x] create 系エラーを UI 向けへ変換する関数を追加
- Validation:
  - `cd typescript && npm run test -- 'src/shared/api/guild-channel-api-client.test.ts'`
  - `cd typescript && npm run typecheck`

### M2: FE モーダル接続と導線整備
- Acceptance criteria:
  - [x] server 作成成功時に `/channels/{guildId}` へ遷移
  - [x] channel 作成成功時に `/channels/{guildId}/{channelId}` へ遷移
  - [x] create 失敗時にモーダル内エラー表示を実装
  - [x] server context menu に channel 作成導線を追加
  - [x] channel 種別は v1 でテキストのみ有効化
- Validation:
  - `cd typescript && npm run test -- 'src/features/context-menus/ui/server-context-menu.test.tsx' 'src/features/modals/ui/create-channel-modal.test.tsx' 'src/features/modals/ui/create-server-modal.test.tsx'`
  - `cd typescript && npm run lint`

### M3: 統合確認
- Acceptance criteria:
  - [x] 追加差分の TypeScript test/typecheck/lint が通過
  - [x] `make rust-lint` が通過
  - [ ] `make validate` が通過
- Validation:
  - `cd typescript && npm run test -- 'src/shared/api/guild-channel-api-client.test.ts' 'src/shared/config/routes.test.ts' 'src/features/context-menus/ui/server-context-menu.test.tsx' 'src/features/modals/ui/create-channel-modal.test.tsx' 'src/features/modals/ui/create-server-modal.test.tsx'` (通過)
  - `cd typescript && npm run typecheck` (通過)
  - `cd typescript && npm run lint` (通過)
  - `make rust-lint` (通過)
  - `make validate` (失敗: Python dev-tools の install が PEP 668 制約で失敗)
