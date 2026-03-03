# Implement.md (Runbook)

- Follow Plan.md as the single execution order. If order changes are needed, document the reason in Documentation.md and update it.
- Keep diffs small and do not mix in out-of-scope improvements.
- Run validation after each milestone and fix failures immediately before continuing.
- Continuously update Documentation.md with decisions, progress, demo steps, and known issues.

## Execution log
- M1:
  - `git merge --no-edit origin/main` で LIN-810 前提を取り込み。
  - `shared/api/guild-channel-api-client.ts` に create 系実装を追加。
  - create 系の user-facing message 変換（`toCreateActionErrorText`）を追加。
- M2:
  - `create-server-modal.tsx` を `mutateAsync + router.push` に変更し、成功遷移と失敗表示を実装。
  - `create-channel-modal.tsx` を `mutateAsync + router.push` に変更し、成功遷移と失敗表示を実装。
  - channel 種別 UI を v1 制約に合わせてテキスト以外 disabled 化。
  - `server-context-menu.tsx` に `チャンネルを作成` を追加（`serverId` を modal props へ渡す）。
  - React Query create mutation の `setQueryData` を追加し、一覧反映遅延を抑制。
- M3:
  - API/route/UI テストを追加または更新して回帰を固定。
  - `create-server-modal` テストのアクセシブル名判定を正規表現化し、絵文字付与時でも壊れないように修正。
  - `make rust-lint` を実行し通過。
  - `make validate` は Python 環境制約（PEP 668）で失敗を確認。
