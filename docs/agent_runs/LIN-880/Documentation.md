# Documentation.md (Status / audit log)

## Current status
- Now:
  - 実装と主要検証は完了。
- Next:
  - commit / PR 用の整理のみ。

## Decisions
- 削除確認フローは単一確認ダイアログを採用する。
- 削除後 fallback は残りサーバー優先、なければ `/channels/me` とする。
- 権限境界は既存 guild update と同じ owner または `allow_manage = TRUE` に揃える。
- 既存のチャンネル削除や脱退導線には触れず、server settings の danger zone に限定して delete 導線を追加する。
- AuthZ resource 解決は `/guilds/{id}` と `/v1/guilds/{id}` の両方で guild resource に寄せ、DELETE でも既存 manage 境界を再利用する。

## How to run / demo
- `make validate`
- `make rust-lint`
- `npm -C typescript run typecheck`
- サーバー設定を開く。
- `サーバー概要` の danger zone から削除ダイアログを開く。
- 現在表示中のサーバーを削除し、残存サーバーがあれば `/channels/{serverId}`、なければ `/channels/me` に遷移することを確認する。

## Implementation notes
- Backend に `DELETE /guilds/{guild_id}` を追加し、SQL は guild row を `FOR UPDATE` で掴んだ上で owner または `allow_manage = TRUE` を持つ role のみ削除可能にした。
- delete 成功時は `204 No Content` を返し、拒否時は既存 `GuildChannelError` mapping を通して `403/404/503` 契約に揃えた。
- Frontend は `GuildChannelAPIClient.deleteServer` を追加し、guild/channel キャッシュを削除して rail の不整合を残さないようにした。
- `ServerOverview` に danger zone を追加し、`ServerDeleteModal` で単一確認、削除中表示、失敗時メッセージ表示を持たせた。
- 削除対象が現在表示中サーバーのときだけ query cache の残存サーバーから遷移先を選び、settings overlay は `onDeleted` で閉じるようにした。

## Validation
- `cargo test --manifest-path rust/Cargo.toml -p linklynx_backend delete_guild_`
- `cargo test --manifest-path rust/Cargo.toml -p linklynx_backend guild_channel::tests`
- `npm -C typescript run test -- src/shared/api/guild-channel-api-client.test.ts src/features/settings/ui/server/server-overview.test.tsx src/features/settings/ui/server/server-delete-modal.test.tsx`
- `npm -C typescript run typecheck`
- `make rust-lint`
- `make validate`

## Validation results
- backend targeted tests: pass
- frontend targeted vitest: pass
- typecheck: pass
- `make rust-lint`: pass
  - sandbox では既存 SpiceDB/AuthZ 系テストが `Operation not permitted` になるため、昇格実行で確認
- `make validate`: pass
  - sandbox では Docker socket 制約があるため、昇格実行で確認

## Review results
- reviewer: manual pass
  - no blocking findings
  - sub-agent orchestration が安定せず reviewer 出力を回収できなかったため、変更差分を手動で再読して P1 以上の問題がないことを確認した
- reviewer_ui_guard: true
  - matched files: `typescript/src/features/settings/ui/server/server-overview.tsx`, `typescript/src/features/settings/ui/server/server-delete-modal.tsx`, `typescript/src/features/settings/ui/settings-layout.tsx`
  - rationale: server settings UI と modal に直接変更が入っている
- reviewer_ui: manual pass
  - no blocking findings
  - local runtime UI は環境競合で完了できなかったため、UI 差分とテストを手動レビューした

## Runtime smoke
- `make dev`: failed
  - frontend 側で `next: command not found` が出て停止し、repo の dev stack は最後まで上がらなかった
- `make rust-dev`: failed
  - `Address already in use` で `:8080` bind に失敗した
- local HTTP probe:
  - `curl -i -sS http://127.0.0.1:8080/health` => `200 OK`
  - `curl -i -sS http://127.0.0.1:3000/channels/me` => `404 Not Found`
- environment assessment:
  - `lsof -nP -iTCP:8080 -sTCP:LISTEN` で既存 `linklynx_backend` listener が存在
  - `lsof -nP -iTCP:3000 -sTCP:LISTEN` で別 Node app が存在し、返却 HTML もこの repo の UI ではなかった
  - そのため route-level smoke / Playwright smoke は今回の worktree 差分に対して完了不能
  - current assessment: targeted tests、typecheck、`make rust-lint`、`make validate` は通過しているが、local runtime smoke は既存プロセス競合と frontend 実行環境の問題で incomplete

## Known issues / follow-ups
- local runtime smoke は環境競合で完了していない。`3000/8080` の既存 listener を整理し、frontend の `next` 実行環境が揃った状態で再試行すると UI 実機確認まで進める。

## Known issues / follow-ups
- None yet.
