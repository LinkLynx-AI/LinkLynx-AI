# Documentation.md (Status / audit log)

## Current status
- Now:
  - branch `codex/LIN-943-channel-category-frontend` を `LIN-942` merge 後の HEAD から作成した。
  - category-aware な frontend 実装、review 指摘の修正、validation、runtime smoke まで完了した。
- Next:
  - commit / PR を作成し、child issue を merge 可能な状態にする。

## Decisions
- category row は非 message target のため、sidebar では header toggle 専用にする。
- child channel 作成導線は「server 直下 category 作成」と「選択中 category 配下 text channel 作成」を分ける。
- category 作成後は route 遷移せず、配下 text channel 作成後のみ `/channels/{guildId}/{channelId}` へ遷移する。
- delete 後 fallback と server page redirect は text channel のみを遷移先候補にする。
- direct category route は `ChannelView` 側で最初の text channel か guild root へ redirect する。

## Validation log
- 2026-03-09: `cd typescript && npm run typecheck` 成功
- 2026-03-09: `cd typescript && npm test -- src/shared/api/guild-channel-api-client.test.ts src/features/modals/ui/create-channel-modal.test.tsx src/features/modals/ui/channel-delete-modal.test.tsx src/features/context-menus/ui/server-context-menu.test.tsx src/features/context-menus/ui/channel-context-menu.test.tsx src/widgets/channel-sidebar/ui/channel-item.test.tsx src/widgets/chat/ui/channel-view.test.tsx 'src/app/channels/[serverId]/page.test.ts'` 成功（8 files / 56 tests）
- 2026-03-09: `make validate` 成功
- 2026-03-10: reviewer 指摘 3 件を修正
  - category route redirect が guild channel list 未読込時に guild root へ誤遷移する race を解消
  - sidebar の top-level 並び順を `position` 準拠へ修正
  - category delete 後に child detail query cache が残る不整合を解消
- 2026-03-10: `cd typescript && npm test -- src/widgets/chat/ui/channel-view.test.tsx src/widgets/channel-sidebar/ui/channel-sidebar.test.ts src/shared/api/mutations/use-channel-actions.test.ts` 成功（3 files / 6 tests）
- 2026-03-10: `cd typescript && npm run typecheck` 成功
- 2026-03-10: `make validate` 成功

## Review log
- 2026-03-10: reviewer
  - block 1 件, major 2 件
  - 対応完了。再検証で `make validate` / targeted tests を通過。
- 2026-03-10: UI gate
  - UI 変更あり判定。対象は sidebar / modal / channel route 一式。

## Runtime smoke
- `cd typescript && npm run dev -- --port 3010` 起動成功
- `GET /` -> `307 /channels/me`
- `GET /channels/2001` -> `200`
- `GET /channels/2001/3100` -> `200`
- limits:
  - local auth 付きの category 作成 UI 完遂までは未実施
  - direct category route の実際の client redirect は component test を primary evidence とした

## How to run / demo
- 1. `cd typescript && npm run typecheck`
- 2. `make validate`

## Known issues / follow-ups
- `LIN-944` で `times` / `times-abe` シナリオの回帰試験と検証手順を固める。
