# Prompt.md (Spec / Source of truth)

## Goals
- `LIN-795` 親 issue として、`LIN-805 -> LIN-809 -> LIN-815` の順で最小レート制限/スパム対策を実装する。
- 投稿/招待/モデレーション経路へ最小限の rate limit を適用し、`429 + Retry-After` 契約を統一する。
- Dragonfly 障害時の degraded enter/exit 条件と fail-close / fail-open の経路別挙動をコードと運用手順に固定する。

## Non-goals
- ML ベースのスパム判定。
- Redis/Dragonfly の実通信プロバイダ導入やアルゴリズム刷新。
- 対象外経路への横展開。

## Deliverables
- Rust backend に operation class / degraded threshold / internal metrics を備えた rate-limit 基盤を追加する。
- `/v1/guilds/{guild_id}/invites/{invite_code}`、`/v1/guilds/{guild_id}/channels/{channel_id}/messages`、`/v1/dms/{channel_id}/messages`、`/v1/moderation/guilds/{guild_id}/members/{member_id}` へ rate limit を適用する。
- `docs/runbooks/dragonfly-ratelimit-operations-runbook.md` を追加し、監視条件と障害模擬試験手順を文書化する。

## Done when
- [ ] operation class と degraded threshold が ADR-005 / `database/contracts/lin139_runtime_contracts.md` と整合する。
- [ ] 対象 REST 経路で超過時に `429 + Retry-After` が返る。
- [ ] 高リスク経路は degraded 時に fail-close、message create は degraded 時に L1-only で継続する。
- [ ] internal metrics / observation と runbook で degraded 遷移と復帰手順が再現できる。

## Constraints
- Perf: 既存 `FixedWindowRateLimiter` を再利用し、最小差分で実装する。
- Security: invite / moderation は高リスク経路として degraded 時に fail-close を維持する。
- Compatibility: 既存 Auth/AuthZ 応答契約は維持し、対象経路にのみ `429 + Retry-After` を追加する。
