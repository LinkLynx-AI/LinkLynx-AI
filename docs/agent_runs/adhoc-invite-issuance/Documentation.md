# Invite Issuance Documentation

## Current status
- Now: invite create backend/frontend を実装済み。server context と channel context の両方から modal を開ける。
- Next: invite list / revoke の real API 化は別スコープ。

## Decisions
- DB へ新しい `channel_id` は追加せず、今回は guild 参加用 invite を指定 channel 文脈から発行する。
- invite 作成 API は `v1` の protected route に追加する。
- server context menu では channel 選択付き modal、channel context では該当 channel を初期選択して開く。
- invite ID は `invites_id_seq` を追加して default 採番に寄せる。

## Validation
- `make db-migrate`
- `make rust-lint`
- `cd typescript && npm run typecheck`
- `cd typescript && npm test -- src/features/modals/ui/create-invite-modal.test.tsx src/features/context-menus/ui/server-context-menu.test.tsx src/features/context-menus/ui/channel-context-menu.test.tsx src/widgets/channel-sidebar/ui/channel-item.test.tsx src/shared/api/queries/use-action-guard.test.ts`
- `make ts-lint` -> failed on pre-existing Prettier drift in `src/shared/api/my-profile-sync.ts` and `src/widgets/chat/ui/channel-view.tsx` after this change set's files were formatted

## Known gaps
- server settings の invite list / revoke は依然として mock のまま。
- invite verify/join は guild 単位で動作し、channel への direct jump までは今回扱わない。
