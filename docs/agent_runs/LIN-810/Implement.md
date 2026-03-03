# Implement.md (Runbook)

- Follow Plan.md as the single execution order. If order changes are needed, document the reason in Documentation.md and update it.
- Keep diffs small and do not mix in out-of-scope improvements.
- Run validation after each milestone and fix failures immediately before continuing.
- Continuously update Documentation.md with decisions, progress, demo steps, and known issues.

## Execution log

1. Scope confirmation
- `gh issue view 936` で LIN-810 の Do/Don't/AC を確認。
- 本 run を child issue start（親: LIN-793）として扱う。
- 作業ブランチ: `codex/lin-810-feat-fe_server`。

2. API integration
- `typescript/src/shared/api/guild-channel-api-client.ts` を追加。
- `GET /guilds`, `GET /guilds/{guild_id}/channels` を実装し、Zodで境界検証。
- `typescript/src/shared/api/api-client.ts` の singleton を `GuildChannelAPIClient` へ差し替え。
- FSD違反回避のため `shared` から `entities/auth` 参照を排除し、`shared/lib/getFirebaseAuth` を利用する実装に調整。
- `NEXT_PUBLIC_API_URL` の解決を遅延化し、singleton初期化時の即時失敗を回避。

3. Route sync + UI state
- `shared/config/routes.ts` に `parseGuildChannelRoute` を追加。
- `server-list.tsx` と `channel-sidebar.tsx` で pathname ベースの active 同期を実装。
- 両ウィジェットに loading/error/empty 表示を追加。
- `/channels/[serverId]/page.tsx` を更新し、最初の text channel への遷移、error/empty 表示を追加。
- Next.js page export 契約を守るため、`page-state.ts` に pure ロジックを分離。
- React Query の再取得失敗時に既存データを優先表示するよう、server/channel 表示分岐を修正。
- `parseGuildChannelRoute` の空セグメント誤解釈（`/channels//...`）を無効化。

4. Tests
- `shared/config/routes.test.ts` に route parse テストを追加。
- `shared/api/guild-channel-api-client.test.ts` を追加。
- `app/channels/[serverId]/page.test.ts` を追加（表示状態分岐テスト含む）。
- `getChannel` の部分失敗耐性・キャッシュ再検証の回帰テストを追加。

5. Validation
- 成功: `cd typescript && npm run fsd:check`
- 成功: `cd typescript && npm run lint`
- 成功: `cd typescript && npm run typecheck`
- 成功: `cd typescript && npm run test -- 'src/app/channels/[serverId]/page.test.ts' 'src/shared/api/guild-channel-api-client.test.ts' 'src/shared/config/routes.test.ts'`
- 成功: `make rust-lint`
- 実施: `spawn_agent(default)` による code/UI レビュー
- 指摘対応: `getChannel` の探索戦略・`page-state` 分離・再取得失敗時の表示維持・route空セグメント対策
- 最終レビュー結果: code/UI ともに `OK`
- 失敗: `make validate`（TypeScript test phaseで Node `v22.4.0` と `jsdom@27` の互換性問題により `ERR_REQUIRE_ESM`, unhandled errors 2件）
