# Documentation

## Current status
- Now: DM backend route/service、DM message 接続、FE DM 一覧/開始/会話接続まで実装済み。
- Next: reviewer 結果回収と、`node_modules` がある環境で TypeScript validation を再実行する。

## Decisions
- `LIN-800` は parent run として扱う。
- 既存 frontend は guild ルートのみ WS subscribe するため、DM はまず REST live 接続を優先する。
- DM message storage は既存 message runtime を再利用し、別 SoR は追加しない。
- sandbox 制約により child branch 作成は失敗したため、実装は現ブランチ `codex/lin800` 上で継続する。
- DM 開始導線は `Friends` 一覧のメッセージボタンから `createDM` を呼び、`/channels/me/{conversationId}` へ遷移する。

## How to run / demo
- `GET /users/me/dms`
- `POST /users/me/dms`
- `GET /v1/dms/{channel_id}`
- `GET/POST /v1/dms/{channel_id}/messages`
- `make rust-lint`

## Validation evidence
- `cd rust && cargo test -p linklynx_backend dm_service_tests -- --nocapture`: pass
- `cd rust && cargo test -p linklynx_backend list_dm_channels_returns_participant_scoped_result -- --nocapture`: pass
- `cd rust && cargo test -p linklynx_backend get_dm_channel_returns_dm_summary -- --nocapture`: pass
- `cd rust && cargo test -p linklynx_backend create_dm_message_returns_created_message -- --nocapture`: pass
- `cd rust && cargo test -p linklynx_backend --no-run`: pass
- `make rust-lint`: pass

## Known issues / follow-ups
- sandbox 制約で docker / localhost bind を伴う live runtime 検証は一部再現できない可能性がある。
- `make validate` / `cd typescript && npm run typecheck` は `node_modules` 未導入で未完了。
- reviewer / UI guard の最終結果は未回収。
