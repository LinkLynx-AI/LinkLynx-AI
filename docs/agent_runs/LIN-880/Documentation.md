# Documentation.md (Status / audit log)

## Current status
- Now:
  - 実装、品質ゲート、記録更新は完了。
- Next:
  - 必要なら commit / PR 化する。

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
  - sandbox では既存 SpiceDB/AuthZ 系テストが `Operation not permitted` になるため、昇格実行で確認

## Review results
- reviewer: pass
  - no blocking findings
  - sub-agent の最終結果は `gate: pass` で、`consolidated_findings` は空だった
  - specialist reviewer の自動分岐は session 制約で unavailable 扱いだったが、reviewer 自身の manual review でも blocking findings はなかった
- reviewer_ui_guard: unreliable
  - UI 差分があるにもかかわらず差分未検出の応答が返り、結果を採用しなかった
- reviewer_ui: pass
  - no blocking findings
  - server settings UI、delete modal、cache cleanup、削除後遷移について blocking findings なし
  - browser smoke は未実施

## Runtime smoke
- `make dev`: failed
  - sandbox 実行では Docker daemon への接続権限不足で停止した
  - 昇格実行では backend が `Address already in use` で `:8080` bind に失敗した
  - 同じ run で frontend は `pnpm run dev` 内で `next: command not found` により停止した
- environment assessment:
  - 新規 dev boot は環境依存で完了できなかったため、Playwright を含む UI 実機 smoke は未実施
  - current assessment: targeted tests、typecheck、`make rust-lint`、`make validate` は通過しており、fresh dev boot は環境要因で incomplete

## Known issues / follow-ups
- local runtime smoke は frontend 実行環境と `:8080` の port 競合により fresh dev boot まで完了していない。環境を整理してから再試行すると UI 実機確認まで進める。
