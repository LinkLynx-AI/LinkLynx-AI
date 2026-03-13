# Prompt

## Goals
- `PATCH /v1/moderation/guilds/{guild_id}/members/{member_id}` をスタブ応答から実処理へ接続する。
- AuthZ deny / target not found / dependency unavailable の結果を既存 moderation contract に従って返す。
- 実行者 / guild / 対象 member / action を監査しやすい形で残す。

## Non-goals
- `ban` や永続的な unmute API の追加。
- moderation domain の大規模再設計。
- rate limit policy や AuthZ matrix 自体の変更。

## Deliverables
- v1 moderation PATCH handler の実装。
- target member 存在確認を含む moderation service / Postgres 振る舞いの更新。
- PATCH 成功 / 404 / 503 の回帰テスト。
- LIN-978 run memory と検証ログ。

## Done when
- [ ] PATCH が `create_mute` 実処理へ接続される
- [ ] target member 未存在時に `404` になる
- [ ] 依存障害時に `503` になる
- [ ] structured log と検証結果が残る

## Constraints
- Perf: 既存 moderation read/write path に不要な複雑性を追加しない。
- Security: fail-close と high-risk route の保護を崩さない。
- Compatibility: 既存 moderation error code / status mapping を維持する。
