# LIN-894 Prompt

## Goals
- `LIN-894` を parent issue として扱い、child issue を順番に完了させる。
- `LIN-927` / `LIN-928` / `LIN-929` の進捗と証跡を親 run 台帳から追跡できるようにする。
- moderation の `report queue/list/detail` と `report / mute / resolve / reopen` の最小運用導線を、child issue ごとの責務を崩さず end-to-end で成立させる。

## Non-goals
- BAN の導入
- 自動判定
- 高度な管理画面
- 外部連携

## Deliverables
- 親 issue と child issue の対応関係が分かる run 台帳
- child issue ごとの branch / validation / review / smoke 証跡
- 親ブランチ `codex/lin-894` に集約される moderation 導線の受け入れ根拠

## Done when
- [ ] child issue の順序と状態が親 run 台帳へ反映されている
- [ ] moderation queue / detail / action flow が child issue の受け入れ条件に沿って動く
- [ ] `guild:moderate` fail-close が維持される
- [ ] `make validate` と issue-specific validation が通る
- [ ] review gate の blocking finding が解消される
- [ ] 子 PR / 親ブランチ向けの要約と根拠が揃う

## Constraints
- Perf: 既存 API / query invalidation の範囲に留める
- Security: AuthZ fail-close を崩さない
- Compatibility: report state は `open` / `resolved` を維持し、既存 API を壊さない
