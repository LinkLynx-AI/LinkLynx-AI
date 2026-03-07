# Documentation.md (Status / audit log)

## Current status
- Now: ActionGuard hook と対象 UI の fail-close guard を実装済み。validation と runtime smoke は完了し、残りは reviewer gate の最終記録と PR 作成。
- Next: `reviewer_ui` の最終結果を反映し、branch を commit/push して `main` 向け PR を作る。

## Decisions
- invite 作成は `main` 時点で real API/client が未実装のため、`LIN-926` では導線停止に留める。
- 権限不足の page は guard screen、個別操作は disabled で fail-close にする。
- backend 契約は既存 `GET /guilds/{guild_id}/permission-snapshot` をそのまま使う。
- server settings は modal 全体、moderation は page 全体を guard し、channel manage 系は entrypoint と destructive action の両方で guard する。
- invite modal 自体も fail-close にし、誤って開かれても作成処理を実行しない static screen に置き換える。

## How to run / demo
- `cd typescript && npm run typecheck`
- `cd typescript && npm test -- src/shared/api/queries/use-action-guard.test.ts src/features/context-menus/ui/server-context-menu.test.tsx src/features/context-menus/ui/channel-context-menu.test.tsx src/widgets/channel-sidebar/ui/channel-item.test.tsx src/features/modals/ui/create-channel-modal.test.tsx src/features/settings/ui/settings-layout.test.tsx src/features/modals/ui/channel-edit-overview.test.tsx src/features/modals/ui/channel-delete-modal.test.tsx src/features/moderation/ui/moderation-queue-page.test.tsx src/features/moderation/ui/moderation-report-detail-page.test.tsx`
- `cd typescript && npm test -- src/shared/api/queries/use-action-guard.test.ts src/features/context-menus/ui/server-context-menu.test.tsx src/features/context-menus/ui/channel-context-menu.test.tsx src/widgets/channel-sidebar/ui/channel-item.test.tsx src/features/modals/ui/create-channel-modal.test.tsx src/features/modals/ui/create-invite-modal.test.tsx src/features/settings/ui/settings-layout.test.tsx src/features/modals/ui/channel-edit-overview.test.tsx src/features/modals/ui/channel-delete-modal.test.tsx src/features/moderation/ui/moderation-queue-page.test.tsx src/features/moderation/ui/moderation-report-detail-page.test.tsx`
- `make rust-lint`
- `make validate`

## Validation log
- `cd typescript && npm run typecheck`: pass
- `cd typescript && npm test -- src/shared/api/queries/use-action-guard.test.ts src/features/context-menus/ui/server-context-menu.test.tsx src/features/context-menus/ui/channel-context-menu.test.tsx src/widgets/channel-sidebar/ui/channel-item.test.tsx src/features/modals/ui/create-channel-modal.test.tsx src/features/modals/ui/create-invite-modal.test.tsx src/features/settings/ui/settings-layout.test.tsx src/features/modals/ui/channel-edit-overview.test.tsx src/features/modals/ui/channel-delete-modal.test.tsx src/features/moderation/ui/moderation-queue-page.test.tsx src/features/moderation/ui/moderation-report-detail-page.test.tsx`: pass (`11 files / 29 tests`)
- `make rust-lint`: pass
- `make validate`: pass

## Runtime smoke
- `cd typescript && npm run dev -- --hostname 127.0.0.1 --port 3000` で Next.js を起動し、fatal runtime error が出ないことを確認
- `GET /channels/me`: `200`
- `GET /channels/2001/moderation`: `200`
- `GET /channels/2001/moderation/7001`: `200`

## Review gate
- `reviewer`: pass, blocker なし
- `reviewer_ui_guard`: `run_ui_checks=true`
- `reviewer_ui`: 実行中

## Known issues / follow-ups
- invite 作成 API/client の整備は別 issue で扱う。
- `useActionGuard` は `503/AUTHZ_UNAVAILABLE` 以外の query error を `forbidden` に畳む。現行契約には沿うが、将来 `401` や generic `5xx` を別 UX に分離する場合は見直しが必要。
- `ChannelEditModal` の overview/delete 以外のタブ自体は modal レベルで閉じていない。現時点では実 API mutation の入口ではないため blocker にはしていない。
