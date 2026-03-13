# Prompt.md (Spec / Source of truth)

## Goals
- `LIN-930` として v1 主要導線の実処理接続漏れを解消する。
- frontend の `members / roles / other-user profile` を backend 実データへ接続する。
- 既存 frontend hook 契約を維持したまま API client と主要 UI を実接続へ切り替える。

## Non-goals
- `LIN-931` の WebSocket 認証ガード変更。
- `LIN-932` の protocol compatibility / 永続化締め。
- settings 全体や v2 寄り UI のモック一括回収。
- other-user avatar/banner の signed URL 契約追加。

## Deliverables
- Rust read-only endpoint 追加:
  - `GET /v1/guilds/{guild_id}/members`
  - `GET /v1/guilds/{guild_id}/roles`
  - `GET /v1/users/{user_id}/profile`
- TypeScript `GuildChannelAPIClient` の read mapping 実装。
- member/profile 系 UI の mock 依存除去。
- Rust / TypeScript の回帰テスト追加。

## Done when
- [ ] members / roles / other-user profile が backend 実データを読む。
- [ ] member list / profile popout / profile modal が mock import を使わない。
- [ ] `make validate` / `make rust-lint` / `cd typescript && npm run typecheck` が通る。

## Constraints
- Perf: query は read-only 最小範囲に留め、一覧は v1 必要十分な shape に限定する。
- Security: guild read は membership 必須、other-user profile は self または shared guild 前提で fail-close。
- Compatibility: frontend hook signature は変更しない。event / WS contract は変更しない。
