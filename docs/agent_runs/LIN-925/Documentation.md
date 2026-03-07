# LIN-925 Documentation

## Current status
- Now: backend endpoint / frontend client-query / docs まで実装済み
- Next: `LIN-926` 向けに ActionGuard 適用面へ接続する

## Decisions
- `LIN-925` は docs + backend endpoint + frontend 型/hook まで含める
- UI 適用は `LIN-926` へ分離する
- endpoint は `GET /v1/guilds/{guild_id}/permission-snapshot?channel_id=...` で固定する
- guild scope の `can_create_channel / can_create_invite / can_manage_settings / can_moderate` は `Guild + Manage` を共有する
- channel scope の `can_view / can_post / can_manage` は `GuildChannel + View/Post/Manage` を個別評価する
- `Denied` は boolean `false` へ畳み込み、`DependencyUnavailable` は endpoint 全体を `503/AUTHZ_UNAVAILABLE` とする

## Review gate
- `reviewer_simple` / `reviewer_ui_guard` を subagent で回そうとしたが、この環境では結果を回収できなかったため手元レビューへ fallback
- fallback review result: blocking finding なし
- UI guard result: `true`
- rationale: `typescript/src/shared/api/**/*.ts` に client/query 追加があり、frontend runtime surface に影響する
- UI checks: `make validate` 内の `pnpm lint` / `pnpm typecheck` / `pnpm test` pass

## How to run / demo
- `make rust-lint`
- `cd typescript && npm run typecheck`
- `make validate`

## Known issues / follow-ups
- 現行 non-`v1` FE API と `v1` AuthZ matrix の path alignment は `LIN-926` 側論点
- `guild.can_view` は route 自体が `Guild + View` を通過条件にするため、`200` では常に `true`
- runtime smoke は local `8080` 競合があり再起動は安定しなかったが、`SpiceDB health` pass と `GET /health` / `GET /` の `200` を確認済み
- protected snapshot route の authenticated runtime smoke は local Firebase token 前提のため省略し、Rust contract test を primary evidence とした
