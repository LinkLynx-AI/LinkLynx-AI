# Documentation.md (Status / audit log)

## Current status
- Now: edit/delete API client、optimistic mutation、message UI/context menu、tombstone 表示まで実装し、TypeScript/Rust の gate を通した。
- Next: reviewer 結果を反映して PR を作成し、`LIN-801` を完了させる。

## Decisions
- `LIN-831` では backend snapshot を再利用し、frontend 側で独自 DTO は増やさない。
- conflict / 権限エラー時は invalidate により server snapshot を再取得し、表示破綻より再同期を優先する。
- tombstone は空文字のままではなく、削除済み表示に正規化する。
- inline edit 状態は `UIStore` に持ち、hover action と context menu の両方から同じ editor を開く。

## How to run / demo
- `cd typescript && pnpm vitest run src/shared/api/guild-channel-api-client.test.ts`
- `cd typescript && pnpm vitest run src/shared/api/mutations/use-message-actions.test.ts`
- `cd typescript && pnpm vitest run src/shared/api/mutations/use-edit-message.test.ts`
- `cd typescript && pnpm vitest run src/features/context-menus/ui/message-context-menu.test.tsx`
- `cd typescript && pnpm vitest run src/widgets/chat/ui/message/message.test.tsx`
- `cd typescript && npm run typecheck`
- `cd typescript && make validate`
- `make rust-lint`

## Known issues / follow-ups
- root `make validate` は Python dev tool bootstrap が PEP 668 `externally-managed-environment` で停止するため、この環境では完走しない。

## Validation evidence
- `make validate`: fail（`python && make format` が PEP 668 `externally-managed-environment` で停止）
- `make rust-lint`: pass
- `cd typescript && npm run typecheck`: pass
- `cd typescript && pnpm vitest run src/shared/api/guild-channel-api-client.test.ts src/shared/api/mutations/use-message-actions.test.ts src/shared/api/mutations/use-edit-message.test.ts src/features/context-menus/ui/message-context-menu.test.tsx src/widgets/chat/ui/message/message.test.tsx`: pass
- `cd typescript && make validate`: pass

## Review gate
- `reviewer_ui`: unavailable（agent interrupt / result 未回収）
- `reviewer_simple`: unavailable（agent interrupt / result 未回収）
