# Documentation.md (Status / audit log)

## Current status
- Now: LIN-878 実装・検証完了。
- Next: PR作成（1 issue = 1 PR）とレビュー依頼。

## Decisions
- 更新対象は `name` のみ（`topic` は現行スキーマ外）。
- 権限は owner/admin（`allow_manage=true`）を必須とする。
- チャンネル名の上限は 100 文字。
- パッチ入力は `#[serde(deny_unknown_fields)]` で `name` のみ受理する。
- フロントは optimistic replace（`setQueryData`）+ `invalidateQueries` の併用で整合を維持する。

## How to run / demo
1. APIサーバー起動後、owner/admin ユーザーでログインする。
2. サイドバーの対象チャンネル行で歯車アイコンを押し、編集モーダルを開く。
3. チャンネル名を変更して保存する。
4. 保存成功でモーダルが閉じ、チャンネル一覧と選択中チャンネル名が更新されることを確認する。
5. 非メンバー/権限不足ユーザーで同操作を行い、拒否メッセージが表示されることを確認する。

## Validation evidence
- `cd rust && cargo test -p linklynx_backend guild_channel -- --nocapture` : pass
- `cd typescript && npm run test -- src/shared/api/guild-channel-api-client.test.ts src/features/modals/ui/channel-edit-overview.test.tsx src/widgets/channel-sidebar/ui/channel-item.test.tsx` : pass
- `cd typescript && npm run typecheck` : pass
- `make rust-lint` : pass
- `make validate` : pass

## Review gate evidence
- reviewer_ui_guard: `run_ui_checks: true`
- reviewer: P1/P0 findingsなし（block条件なし）
- reviewer_ui: P1/P0 findingsなし（block条件なし）
- consolidated gate decision: `pass`

## Known issues / follow-ups
- なし
