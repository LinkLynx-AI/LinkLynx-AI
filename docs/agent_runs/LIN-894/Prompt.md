# LIN-894 Prompt

## Goals
- `LIN-894` を leaf issue として 1 PR で完了させる。
- moderation の `report queue/list/detail` と `report / mute / resolve / reopen` の最小運用導線を end-to-end で成立させる。
- 権限制御と監査ログの整合を維持したまま、既存実装の受け入れ基準ギャップを埋める。

## Non-goals
- BAN の導入
- 自動判定
- 高度な管理画面
- 外部連携

## Deliverables
- 必要最小限の backend / frontend 差分
- `/guilds/{guild_id}/moderation/*` の AuthZ resource / action を contract どおりに揃える修正
- 不足しているテストの追加
- `Documentation.md` に validation / review / smoke の証跡

## Done when
- [ ] moderation queue / detail / action flow が動く
- [ ] `guild:moderate` fail-close が維持される
- [ ] `make validate` と issue-specific validation が通る
- [ ] review gate の blocking finding が解消される
- [ ] PR 用の要約と根拠が揃う

## Constraints
- Perf: 既存 API / query invalidation の範囲に留める
- Security: AuthZ fail-close を崩さない
- Compatibility: report state は `open` / `resolved` を維持し、既存 API を壊さない
