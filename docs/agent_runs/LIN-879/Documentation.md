# LIN-879 Documentation Log

## Current status
- LIN-879 の実装と主要検証は完了。
- 残タスクはなし。runtime smoke は環境要因で完了不可と判断した。

## Decisions
- 削除導線は右クリックメニューと編集画面の両方に置いた。
- 現在選択中チャンネル削除時は残存する先頭テキストチャンネルへ遷移し、無ければ `/channels/{serverId}` へ戻す。
- 失敗時にモーダルを閉じないため、汎用 `delete-confirm` は使わず channel 専用モーダルを追加した。
- 先頭テキストチャンネル選択ロジックは `features/channel-navigation` に寄せて、サーバールート遷移と削除後フォールバックで再利用する形にした。

## Implementation notes
- Backend に `DELETE /channels/{channel_id}` を追加し、manage 権限チェックは既存 update と同じ境界に合わせた。
- delete 実行結果が 0 件のときは channel 存在確認、membership、manage 権限の順に再判定して `404/403/503` の既存契約へ寄せた。
- Frontend は API client の実 delete 実装、cache 削除、route フォールバック、削除失敗時のモーダル内エラー表示まで接続した。
- 右クリックと編集画面の両方から同じ `ChannelDeleteModal` を開くようにして、削除処理とエラー表示の実装を一本化した。

## Validation
- `cargo test -p linklynx_backend delete_guild_channel`
- `cargo test -p linklynx_backend delete_guild_channel_sql_requires_manage_role_lookup`
- `cd typescript && npm run test -- src/shared/api/guild-channel-api-client.test.ts src/features/context-menus/ui/channel-context-menu.test.tsx src/features/modals/ui/channel-edit-overview.test.tsx src/features/modals/ui/channel-delete-modal.test.tsx`
- `cd typescript && npm run typecheck`
- `make rust-lint`
- `make validate`

## Validation results
- backend targeted tests: pass
- frontend targeted vitest: pass (30 tests)
- typecheck: pass
- `make rust-lint`: pass
- `make validate`: pass
- final TS hardening after `make validate`: `src/features/modals/ui/channel-delete-modal.test.tsx` 再実行 pass、`npm run typecheck` 再実行 pass

## Runtime smoke
- `make dev`: failed during startup.
- `make dev` の途中で Next.js は `Ready` まで到達したが、Rust API の dev build が linker 出力時に `errno=28` で失敗した。
- `df -h .` では `/System/Volumes/Data` の空きが約 `602MiB` しかなく、ディスク逼迫を確認した。
- その後の再試行では Next.js 側も worktree 環境で workspace root 解決に失敗し、`next/package.json` を見つけられず `ts-dev` が終了した。
- `curl http://localhost:3000/channels/1` はサーバー未起動のため失敗し、route-level smoke / Playwright smoke までは進めていない。
- current assessment: 今回の変更差分ではなく、ローカル環境のディスク容量不足と worktree 上の Next.js dev 起動問題が主要因。targeted tests、typecheck、`make rust-lint`、`make validate` はすべて通っている。

## Review results
- `reviewer`: blocking finding なし、という結果のみ回収できた。
- `reviewer_ui_guard`: サブエージェント応答が安定せず結果回収不可。差分上は UI 変更ありと手動判定した。
- `reviewer_ui`: サブエージェント応答が安定せず結果回収不可。manual UI review では blocking issue を確認していない。

## Environment notes
- sandbox 内の Rust test 実行では既存 AuthZ/SpiceDB 系テストが `Operation not permitted` で失敗したため、`make rust-lint` と `make validate` は escalated 実行で通した。
- `npm -C typescript ci` は lockfile 不整合で失敗したため、検証用依存は `npm install --no-package-lock` で補完した。package-lock 自体は変更していない。
- runtime smoke はディスク空き不足と worktree 上の Next.js dev 起動問題で継続不能だった。

## How to run / demo
- 右クリックメニューから `チャンネルを削除` を開き、削除成功時に一覧から対象が消えることを確認する。
- 編集画面の danger セクションから `チャンネルを削除` を開き、同じモーダルで削除できることを確認する。
- 現在表示中のチャンネルを削除し、残っている先頭テキストチャンネルへ遷移することを確認する。
- 残存テキストチャンネルがない状態で削除し、`/channels/{serverId}` に戻ることを確認する。
- 権限なしユーザーで削除して、モーダルを閉じずに拒否メッセージを表示することを確認する。

## Known issues / follow-ups
- local runtime smoke は環境要因で完了していない。ディスク空き確保と worktree 上の Next.js dev 起動問題が解消したら再試行する。
