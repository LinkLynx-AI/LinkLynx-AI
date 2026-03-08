# LIN-928 Prompt

## Goals
- `LIN-928` として moderation report queue/list/detail API の最小契約を成立させる。
- 一覧 API に `status` filter と `limit/after` paging を追加する。
- 既存の queue/detail 導線を壊さず additive に拡張する。

## Non-goals
- BAN の導入
- 高度な管理画面の再設計
- 自動判定
- `LIN-929` に属する新規運用 UI の追加

## Deliverables
- Rust moderation list API の query/filter/paging 対応
- TypeScript API client / query hook の契約更新
- 最小の backend / frontend test 追加
- `Documentation.md` への validation 記録

## Done when
- [ ] `/guilds/{guild_id}/moderation/reports` が `status/limit/after` を受け付ける
- [ ] detail API が既存契約のまま動作する
- [ ] role 外データを漏らさない fail-close を維持する
- [ ] issue-specific validation が通る

## Constraints
- Perf: 既存一覧取得を大きく作り直さず、最小の index-friendly query に留める
- Security: `guild:moderate` fail-close を崩さない
- Compatibility: 既存の `reports` 配列レスポンスを維持しつつ additive に `page_info` を追加する
