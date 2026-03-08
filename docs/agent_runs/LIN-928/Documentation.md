# LIN-928 Documentation Log

## Current status
- Now: commit / PR 作成前の証跡整理まで完了
- Next: `codex/lin-894` 向け PR を作成して LIN-929 着手前の状態を固定する

## Decisions
- list API は additive 変更として `reports` を維持し、`page_info` を追加する
- paging cursor は `created_at|report_id` 形式で返す
- status filter は `open` / `resolved` のみを受け付ける
- query validation は handler 側で fail-close に処理し、service には検証済み入力のみ渡す

## How to run / demo
1. `cd rust && cargo test -p linklynx_backend moderation -- --nocapture`
2. `cd rust && cargo test -p linklynx_backend list_moderation_reports -- --nocapture`
3. `cd typescript && npm run typecheck`
4. `cd typescript && pnpm test -- moderation --runInBand`
5. `GET /guilds/{guild_id}/moderation/reports`
6. `GET /guilds/{guild_id}/moderation/reports?status=open&limit=20`
7. `GET /guilds/{guild_id}/moderation/reports?status=resolved&limit=1`
8. `GET /guilds/{guild_id}/moderation/reports?after=<next_after>`
9. `GET /guilds/{guild_id}/moderation/reports/{report_id}`

## Known issues / follow-ups
- `LIN-929` 側で UI に filter/paging 操作を出すかは別 issue で判断する
- `pnpm test -- moderation --runInBand` では既存の `act(...)` warning が `user-profile` 関連テストから出るが、今回差分起因ではなく pass している

## Validation log
- 2026-03-08: `cd rust && cargo test -p linklynx_backend moderation -- --nocapture` ✅
- 2026-03-08: `cd typescript && npm run typecheck` ✅
- 2026-03-08: `cd typescript && pnpm test -- moderation` ✅
- 2026-03-08: `make rust-lint` ✅
- 2026-03-08: `make validate` は `typescript` の `eslint` 実行中に完了結果を取得できず、pass/fail 未確定

## Review gate
- 2026-03-08: `reviewer_simple` ✅
  - 判定: pass / no blocking findings
  - 補足: UI 影響あり。`pnpm typecheck` と `pnpm test` は pass、`pnpm lint` は review window 内で完了確認できず
- 2026-03-08: UI 影響ファイル
  - `typescript/src/features/moderation/ui/moderation-queue-page.tsx`
