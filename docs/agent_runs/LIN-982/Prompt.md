# Prompt.md (Spec / Source of truth)

## Goals
- `GET /v1/guilds/{guild_id}/invites` を実 DB backed で追加する。
- `DELETE /v1/guilds/{guild_id}/invites/{invite_code}` を実装し、招待取消を `invites.is_disabled = TRUE` で表現する。
- invite list / revoke を既存の v1 invite/authz/rate-limit/error 契約に合わせる。
- TypeScript の invite client と招待管理 UI を real API に接続し、server settings / channel edit の mock 依存を除去する。

## Non-goals
- 新しい invite schema や channel 紐付け列の追加。
- event schema 変更。
- sibling issue に相当する invite create / join / verify の再設計。

## Deliverables
- Rust invite service / Postgres 実装の list + revoke 追加。
- Rust routes / rate limit / authz matrix docs / tests 更新。
- TypeScript API client / query / mutation / UI の real API 化。
- `docs/agent_runs/LIN-982/Documentation.md` への decisions と検証ログ記録。

## Done when
- [ ] guild invite list が real DB データを返す。
- [ ] guild invite revoke が権限・未存在・rate limit 契約込みで動作する。
- [ ] server settings と channel edit invites が real API を使う。
- [ ] required validations / tests / review evidence を残せる。

## Constraints
- Perf: guild-scoped invite list は channel edit 用の追加 endpoint を増やさず再利用する。
- Security: AuthZ fail-close、InviteAccess rate limit の degraded fail-close を維持する。
- Compatibility: existing invite verify/join/create contract は壊さない。event contract 変更なし。
