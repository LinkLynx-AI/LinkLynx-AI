# LIN-802 Plan

## Rules
- 実装順は `LIN-822 -> LIN-832 -> LIN-833` の責務順を1ブランチ内で段階実装する。
- 検証失敗時は次工程へ進まず修正して再実行する。

## Milestones
### M1: Backend + DB（LIN-822 相当）
- Acceptance criteria:
  - [x] `/guilds/{guild_id}/moderation/reports` と `/moderation/mutes` が実装される。
  - [x] `audit_action` が report/mute 系へ拡張される。
  - [x] `moderation_reports` / `moderation_mutes` migration が追加される。
- Validation:
  - `make rust-lint`

### M2: 状態遷移 + ロール制御（LIN-832 相当）
- Acceptance criteria:
  - [x] `resolve/reopen` API が実装される。
  - [x] owner/admin 以外は拒否される。
  - [x] 遷移操作が `audit_logs` に記録される。
- Validation:
  - `cd rust && cargo test -p linklynx_backend moderation`

### M3: FE導線（LIN-833 相当）
- Acceptance criteria:
  - [x] `/channels/[serverId]/moderation` キュー画面が実装される。
  - [x] `/channels/[serverId]/moderation/[reportId]` 詳細画面が実装される。
  - [x] resolve/reopen/mute がUIから実行できる。
- Validation:
  - `cd typescript && npm run typecheck`
  - `cd typescript && npm run lint`
