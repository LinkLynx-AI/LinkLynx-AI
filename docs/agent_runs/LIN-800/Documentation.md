# Documentation

## Current status
- Now: 最新 `main` を `codex/lin800` へ merge し、DM message service と guild message edit/delete の競合を解消済み。
- Next: reviewer 結果回収と、merge 後の全体 validation / PR 整理を進める。

## Decisions
- `LIN-800` は parent run として扱う。
- 既存 frontend は guild ルートのみ WS subscribe するため、DM はまず REST live 接続を優先する。
- DM message storage は既存 message runtime を再利用し、別 SoR は追加しない。
- sandbox 制約により child branch 作成は失敗したため、実装は現ブランチ `codex/lin800` 上で継続する。
- DM 開始導線は `Friends` 一覧のメッセージボタンから `createDM` を呼び、`/channels/me/{conversationId}` へ遷移する。
- `main` から入った guild message edit/delete は保持しつつ、LIN-800 の DM list/create を `MessageService` 上で共存させる。
- DM adapter の `MessageErrorKind` 変換は、追加された `MessageNotFound` / `AuthzDenied` / `Conflict` を既存の DM error surface へ写像して後方互換を保つ。

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
- `cd rust && cargo test -p linklynx_backend --no-run`: pass (merge conflict resolution 後に再実行)
- `cd rust && cargo test -p linklynx_backend dm_ -- --nocapture`: pass
- `cd rust && cargo test -p linklynx_backend channel_message_returns_ -- --nocapture`: pass
- `cd typescript && npm run typecheck`: pass

## Known issues / follow-ups
- sandbox 制約で docker / localhost bind を伴う live runtime 検証は一部再現できない可能性がある。
- `make validate` / `cd typescript && npm run typecheck` は `node_modules` 未導入で未完了。
- reviewer / UI guard の最終結果は未回収。
