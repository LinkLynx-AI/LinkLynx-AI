# LIN-806 Prompt

## Goal
- `guild/channel` の最小 Backend API（一覧/作成）を実装する。
- メンバー境界のアクセス制御を適用する。
- 後続FE（LIN-810）および権限/招待系Issueが利用できるAPI契約を固定する。

## Non-goals
- 招待/DMロジックの実装。
- カテゴリ/スレッドの本実装。
- UI実装や導線接続の実装。

## Done conditions
- `GET/POST /guilds` を実装済み。
- `GET/POST /guilds/{guild_id}/channels` を実装済み。
- 非メンバーアクセスが `403 AUTHZ_DENIED` で拒否される。
- `docs/agent_runs/LIN-806/Documentation.md` に検証結果が記録される。
