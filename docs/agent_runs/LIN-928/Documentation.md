# LIN-928 Documentation Log

## Current status
- Now: filter/paging 契約、queue UI の追加読込、lint/typecheck/test/review 反映まで完了
- Next: `codex/lin-894` 向け PR に載せる child issue 要約を確定する

## Decisions
- list API は additive 変更として `reports` を維持し、`page_info` を追加する
- paging cursor は `created_at|report_id` 形式で返す
- status filter は `open` / `resolved` のみを受け付ける
- query validation は handler 側で fail-close に処理し、service には検証済み入力のみ渡す
- queue UI は `page_info.next_after` / `has_more` を使って older reports を追加取得できる形にする

## How to run / demo
1. `cd rust && cargo test -p linklynx_backend moderation -- --nocapture`
2. `cd rust && cargo test -p linklynx_backend list_moderation_reports -- --nocapture`
3. `cd typescript && npm run typecheck`
4. `cd typescript && pnpm test -- moderation --runInBand`
5. `cd typescript && pnpm exec eslint src/features/moderation/ui/moderation-queue-page.tsx src/shared/api/queries/use-moderation-reports.ts src/shared/api/guild-channel-api-client.test.ts --max-warnings=0`
6. `GET /guilds/{guild_id}/moderation/reports`
7. `GET /guilds/{guild_id}/moderation/reports?status=open&limit=20`
8. `GET /guilds/{guild_id}/moderation/reports?status=resolved&limit=1`
9. `GET /guilds/{guild_id}/moderation/reports?after=<next_after>`
10. queue UI で `次を読み込む` を押して older reports が継続表示されることを確認する
11. `GET /guilds/{guild_id}/moderation/reports/{report_id}`

## Known issues / follow-ups
- `LIN-929` 側で UI に filter/paging 操作を出すかは別 issue で判断する
- `pnpm test -- moderation --runInBand` では既存の `act(...)` warning が `user-profile` 関連テストから出るが、今回差分起因ではなく pass している

## Validation log
- 2026-03-08: `cd rust && cargo test -p linklynx_backend moderation -- --nocapture` ✅
- 2026-03-08: `cd rust && cargo test -p linklynx_backend list_moderation_reports -- --nocapture` ✅
- 2026-03-08: `cd typescript && npm run typecheck` ✅
- 2026-03-08: `cd typescript && pnpm test -- moderation --runInBand` ✅
- 2026-03-08: `cd typescript && pnpm test -- guild-channel-api-client moderation-queue-page --runInBand` ✅
- 2026-03-08: `cd typescript && pnpm exec eslint src/features/moderation/ui/moderation-queue-page.tsx src/shared/api/queries/use-moderation-reports.ts src/shared/api/guild-channel-api-client.test.ts --max-warnings=0` ✅

## Review gate
- 2026-03-08: `reviewer_simple` 最終結果: blocking findings なし
- 2026-03-08: `reviewer_simple` 指摘した P2 lint / P3 test gap は今回反映済み
- 2026-03-08: UI 影響ファイル
  - `typescript/src/features/moderation/ui/moderation-queue-page.tsx`
  - `typescript/src/features/moderation/ui/moderation-queue-page.test.tsx`
- 2026-03-08: UI guard 手動判定 `true`
- 2026-03-08: `reviewer_ui` blocking 指摘
  - queue UI が first page で途切れる問題
- 2026-03-08: `reviewer_ui` blocking 指摘は `次を読み込む` 導線の追加で解消
- 2026-03-08: `reviewer_ui` 再確認結果: blocking findings なし
