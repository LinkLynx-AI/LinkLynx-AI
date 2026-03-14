# Documentation.md (Status / audit log)

## Current status
- LIN-982 実装完了。backend に guild-scoped invite list / revoke を追加し、frontend 招待管理 UI を real API 化した。
- required validation は通過済み。`make validate` は Python venv 未作成で一度失敗したが、`cd python && make setup` 後に再実行して成功した。

## Decisions
- revoke API は guild-scoped `DELETE /v1/guilds/{guild_id}/invites/{invite_code}` を正とする。
- `invites` schema に `channel_id` は存在しないため、channel edit invites も guild invite list をそのまま表示し、UI で guild-wide 管理であることを明示する。
- invite 取消の永続状態は schema 追加なしで `invites.is_disabled = TRUE` に寄せる。
- list API は active invite のみを返す。`is_disabled = FALSE` かつ expiration/max-uses を満たす行に限定し、現在の管理 UI と整合させる。

## How to run / demo
- Backend:
  - `GET /v1/guilds/{guild_id}/invites`
  - `DELETE /v1/guilds/{guild_id}/invites/{invite_code}`
- Frontend:
  - server settings の招待一覧で real invite list を表示・取消できる。
  - channel edit の招待タブでも同じ guild invite list を表示し、guild-scope で取消できる。

## Validation evidence
- `cd rust && cargo test -p linklynx_api invite`
- `cd typescript && npm test -- src/shared/api/guild-channel-api-client.test.ts src/features/modals/ui/create-invite-modal.test.tsx src/features/settings/ui/server/server-invites.test.tsx src/features/modals/ui/channel-edit-invites.test.tsx src/features/context-menus/ui/channel-context-menu.test.tsx src/widgets/channel-sidebar/ui/channel-item.test.tsx`
- `cd typescript && pnpm test -- src/features/settings/ui/server/server-invites.test.tsx`
- `cd typescript && npm run typecheck`
- `cd typescript && pnpm run typecheck`
- `make rust-lint`
- `make validate`

## Runtime smoke
- `make dev` を実行し、Scylla bootstrap と Next.js 起動までは成功した。
- Next.js は `3000` 競合のため `http://localhost:3001` で起動し、`GET /` は `307 /channels/me` を返すことを確認した。
- Rust API の新規 `8080` bind は既存プロセス競合で `AddrInUse` になったため、新規起動確認は完了していない。
- 代替として既存 API プロセスへ `curl -i http://127.0.0.1:8080/health` を実行し `200 OK` を確認した。
- invite route registration の live 疎通として `curl -i http://127.0.0.1:8080/v1/guilds/10/invites` を実行し、未認証で `401 AUTH_MISSING_TOKEN` を確認した。

## Known issues / follow-ups
- reviewer は `ServerInvites` の成功時エラーバナー表示回帰を 1 件検出し、同 turn で修正済み。
- 修正後に reviewer quick re-review を実施し、open finding なしを確認した。
- out-of-scope follow-up:
  - invite を channel 単位で正確に管理したい場合は `invites.channel_id` 追加と API contract 更新が別 issue で必要。
  - 認証付き live smoke を自動化したい場合は Firebase token 供給込みの invite management smoke を別 issue で整備する。
