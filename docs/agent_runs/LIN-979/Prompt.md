# Prompt

## Goals
- moderation v1 route の AuthZ matrix / Dragonfly rate-limit 境界を実装と文書で再整合する。
- `PATCH /v1/moderation/guilds/{guild_id}/members/{member_id}` の拒否/制限ログに追跡可能な scope を残す。
- moderation と permission-snapshot を含む request scope 抽出をテストで固定する。

## Non-goals
- moderation PATCH の実処理接続そのもの。
- Dragonfly provider 実装や threshold の再設計。
- 新しい rate-limit action や AuthZ action の追加。

## Deliverables
- REST middleware の reject log scope 追加。
- request scope / moderation matrix の回帰テスト。
- `docs/AUTHZ_API_MATRIX.md` と Dragonfly runbook の整合更新。
- LIN-979 run memory。

## Done when
- [ ] moderation route の AuthZ/resource/action と request scope がテストで固定される
- [ ] moderation fail-close rate limit の理由コードと required log fields が文書化される
- [ ] reject log に `reason` / `principal_id` / `guild_id` が残る実装になる

## Constraints
- ADR-004 fail-close と ADR-005 hybrid policy を崩さない。
- scope は moderation / permission snapshot / shared REST middleware に限定する。
