# Documentation.md (Status / audit log)

## Current status
- Now:
  - LIN-810 実装差分は完了（server rail/channel list 実データ接続、ルート同期、空状態表示）。
  - TypeScript lint/typecheck/FSD は通過。
  - `make rust-lint` は通過。
  - `make validate` は TypeScript テスト段で環境要因により失敗。
- Next:
  - PR作成時に `make validate` 失敗理由（Node 22.4.0 + jsdom 互換）を明記する。
  - Node を `>=22.12` に揃えた環境で `make validate` を再実行する。
  - 現在の差分内容でPR作成へ進む（review gateは `OK` 到達）。

## Decisions
- `shared` レイヤーから `entities` への依存を避けるため、`GuildChannelAPIClient` 内で認証付き fetch を完結させた。
- API境界の安全性維持のため、guild/channel応答とエラー応答を Zod でバリデーションする方針を採用した。
- `/channels/[serverId]` は最初の text channel へ遷移し、遷移先がない場合のみ empty プレースホルダを表示する方針とした。
- `spawn_agent` の reviewer系 agent type が利用不可だったため、`spawn_agent(default)` を code/UI レビューとして代替運用した。
- 再取得失敗時でも既存データがある場合は一覧を維持する方針にし、エラー表示は「データなし + 失敗」の場合のみ出すよう統一した。
- `getChannel` は partial failure を許容しつつ cached guild も再検証して、新規チャンネル直リンクの誤NotFoundを避ける方針にした。

## How to run / demo
- 1. `npm -C typescript ci`
- 2. `cd typescript && npm run typecheck`
- 3. `cd typescript && npm run test -- 'src/app/channels/[serverId]/page.test.ts' 'src/shared/api/guild-channel-api-client.test.ts' 'src/shared/config/routes.test.ts'`
- 4. `make rust-lint`
- 5. アプリ起動後、`/channels/{guildId}` と `/channels/{guildId}/{channelId}` を遷移して server/channel の active 同期と空状態表示を確認。

## Known issues / follow-ups
- 現在の実行環境（Node `v22.4.0`）では `jsdom@27` との組み合わせで Vitest 実行時に `ERR_REQUIRE_ESM` が発生する。
- このため `make validate` は TypeScript テスト段で失敗する（unhandled errors 2件）。コード変更起因ではなく実行環境起因。
