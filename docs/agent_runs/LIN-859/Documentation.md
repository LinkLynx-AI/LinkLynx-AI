# Documentation.md (Status / audit log)

## Current status
- Now:
  - LIN-859 の FE create 接続実装は完了（server/channel create API 接続、成功遷移、失敗表示、最小導線追加）。
  - 追加テストはすべて通過（`create-server-modal` のアクセシブル名依存を解消済み）。
  - `make rust-lint` は通過。
  - `make validate` は Python 環境制約で失敗（コード差分起因ではない）。
- Next:
  - PR 作成時に `make validate` 失敗理由（PEP 668 による Python dev-tools install 制約）を明記する。
  - reviewer / reviewer_ui_guard / reviewer_ui ゲート結果を PR 本文へ記録する。

## Decisions
- channel 作成導線は server context menu に最小追加する（UI 全面改修はしない）。
- v1 仕様として channel 種別はテキストのみ有効化し、誤操作を防ぐ。
- create 成功後は route を正として同期し、モーダルは閉じる。
- create 失敗はモーダル内 `Input` の error 表示に統一し、一覧 UI は維持する。
- create mutation 成功時に `setQueryData + invalidateQueries` を併用し、即時性と整合性を両立する。

## How to run / demo
- 1. `cd typescript && npm run test -- 'src/shared/api/guild-channel-api-client.test.ts' 'src/shared/config/routes.test.ts' 'src/features/context-menus/ui/server-context-menu.test.tsx' 'src/features/modals/ui/create-channel-modal.test.tsx' 'src/features/modals/ui/create-server-modal.test.tsx'`
- 2. `cd typescript && npm run typecheck`
- 3. `cd typescript && npm run lint`
- 4. `make rust-lint`
- 5. 実機確認:
  - server rail で任意サーバーを右クリックし `チャンネルを作成` を実行
  - チャンネル作成成功後に `/channels/{guildId}/{channelId}` へ遷移することを確認
  - サーバー作成モーダルから作成し `/channels/{guildId}` へ遷移することを確認
  - 不正入力・権限不足時にモーダル内エラーメッセージが表示されることを確認

## Known issues / follow-ups
- `make validate` は `python && make format` の dev-tools 導入フェーズで失敗（externally-managed-environment / PEP 668）。
- Node `v22.4.0` は一部ツール要件（`>=22.12`）を満たしておらず、警告が出る。
