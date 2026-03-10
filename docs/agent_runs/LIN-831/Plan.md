# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: if validation fails, repair it before moving to the next step.

## Milestones
### M1: client contract と error mapping を edit/delete API に接続
- Acceptance criteria:
  - [ ] `GuildChannelAPIClient` が edit/delete endpoint を呼ぶ
  - [ ] conflict / authz エラーを UI 文言へ変換できる
- Validation:
  - `cd typescript && npm run typecheck`

### M2: mutation に optimistic update / rollback を追加
- Acceptance criteria:
  - [ ] edit/delete mutation が `expectedVersion` を送る
  - [ ] 失敗時に query cache を再同期し、成功時に tombstone / edited state を反映する
- Validation:
  - `cd typescript && pnpm vitest run src/shared/api/mutations/use-message-actions.test.ts`

### M3: message UI/context menu を接続
- Acceptance criteria:
  - [ ] own message のみ edit/delete 導線が見える
  - [ ] tombstone 表示と error toast/inline error が動く
- Validation:
  - `cd typescript && pnpm vitest run src/features/context-menus/ui/message-context-menu.test.tsx`
  - `cd typescript && pnpm vitest run src/widgets/chat/ui/message/message.test.tsx`

### M4: evidence を揃えて PR/merge
- Acceptance criteria:
  - [ ] run memory と PR 本文が更新される
  - [ ] required validation が記録される
- Validation:
  - `make validate`
  - `make rust-lint`
  - `cd typescript && npm run typecheck`
