# LIN-925 Implement

- 契約の根拠は `docs/AUTHZ.md` と `docs/AUTHZ_API_MATRIX.md` を起点にする。
- guild/channel/settings/invite/moderation の操作面は snapshot 上の booleans へ集約する。
- deny と unavailable を混同しない。
- 進捗と判断理由は `Documentation.md` に逐次追記する。
- 実装結果:
  - backend: `GET /v1/guilds/{guild_id}/permission-snapshot`
  - frontend: `APIClient#getPermissionSnapshot` と `usePermissionSnapshot`
  - tests: Rust contract test で `deny -> false` / `unavailable -> 503` を固定
  - review: fallback `reviewer_simple` 相当の手元レビューで blocker なし
  - smoke: SpiceDB health と API public route の startup/health/root を確認
  - Claude follow-up: permission check を並列化し、TS 側に ID 変換契約コメントを追加
