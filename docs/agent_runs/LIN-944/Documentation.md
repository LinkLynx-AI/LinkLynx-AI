# Documentation.md

## Current status
- Now:
  - LIN-944 branch を `codex/LIN-943-channel-category-frontend` の HEAD から作成した。
  - backend/frontend の不足回帰を追加し、主要検証コマンドを完了した。
- Next:
  - commit / PR を作成し、LIN-944 を merge 可能な状態にする。

## Initial findings
- backend:
  - category create / child create / category message deny は HTTP テスト済み。
  - invalid parent 系は service mock まではあるが、HTTP 契約の回帰は薄い。
- frontend:
  - API client, create/delete modal, direct category route fallback は回帰済み。
  - sidebar 実描画での mixed order / category 非遷移は補強余地がある。

## Local verification draft
- 前提:
  - backend / frontend がローカル起動できること
  - category 機能を使える権限のあるメンバーでログインしていること
- 最小手順:
  - 1. サーバーの context menu からカテゴリ作成を開き、`times` を作成する。
  - 2. `times` カテゴリの `+` または context menu から配下チャンネル作成を開き、`times-abe` を作成する。
  - 3. sidebar で `times` が非遷移の category header として表示され、`times-abe` がその配下に表示されることを確認する。
  - 4. `times-abe` 作成後に `/channels/{guildId}/{channelId}` へ遷移し、child channel が active になることを確認する。
  - 5. `times` を直接開いた場合は最初の text channel、なければ guild root に redirect されることを確認する。
  - 6. `parent_id` が text channel や未知 channel を指す create request は失敗することを確認する。

## Implemented regressions
- backend:
  - `create_guild_channel_rejects_unknown_parent_channel`
  - `create_guild_channel_rejects_non_category_parent_channel`
- frontend:
  - `ChannelCategory` が link ではなく button として振る舞うこと
  - mixed sidebar で category が top-level text channel より前に並び、child route が active を保つこと

## Validation log
- 2026-03-10: `cd typescript && npm test -- src/widgets/channel-sidebar/ui/channel-category.test.tsx src/widgets/channel-sidebar/ui/channel-sidebar.ui.test.tsx src/widgets/channel-sidebar/ui/channel-sidebar.test.ts` 成功（3 files / 4 tests）
- 2026-03-10: `cd typescript && npm run typecheck` 成功
- 2026-03-10: `cd rust && cargo test create_guild_channel_rejects_unknown_parent_channel --package linklynx_backend` 成功
- 2026-03-10: `cd rust && cargo test create_guild_channel_rejects_non_category_parent_channel --package linklynx_backend` 成功
- 2026-03-10: `make validate` 成功
- 2026-03-10: `make rust-lint` 成功
