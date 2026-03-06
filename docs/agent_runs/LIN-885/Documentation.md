# Documentation.md (Status / audit log)

## Current status
- Now: 実装・検証・review gate 完了。
- Next: 最終共有、必要なら commit / PR 用の整形。

## Decisions
- LIN-885 では新規 settings route を作らず、既存 `user-settings` modal を通常導線へ接続する。
- 2 クリック以内要件は「歯車クリック -> プロフィールタブクリック」で満たす。
- `server-settings` 導線は既存契約のままにして、回帰テストで保護する。
- `UserPanel` の歯車ボタンにはアクセシブル名を付与し、UI テストを role/name ベースで安定化する。
- `reviewer` は blocking finding なしで pass。
- `reviewer_ui_guard` は UI change ありと判定し、`reviewer_ui` を追加実行した。
- `reviewer_ui` は concrete finding なしで pass。既存 `user-profile.test.tsx` の `act(...)` warning は今回差分起因ではない。
- runtime smoke はコード差分が既存 modal を開く 1 ハンドラ追加に閉じるため、component test と `make validate` を優先し手動起動は skip とした。

## How to run / demo
- 1. チャンネル画面左下の歯車ボタンをクリックする。
- 2. ユーザー設定画面が開くことを確認する。
- 3. サイドバーの `プロフィール` をクリックし、プロフィール編集画面へ到達できることを確認する。
- 4. 既存のサーバーコンテキストメニューから `サーバー設定` を開き、従来導線が維持されていることを確認する。
- 検証コマンド:
- `cd typescript && npm run test -- src/widgets/channel-sidebar/ui/user-panel.test.tsx src/features/settings/ui/settings-layout.test.tsx src/features/context-menus/ui/server-context-menu.test.tsx`
- `cd typescript && npm run typecheck`
- `make rust-lint`
- `make validate`

## Known issues / follow-ups
- 初回環境では `npm ci` ではなく `pnpm -C typescript install --frozen-lockfile` が必要だった。`package-lock.json` と `package.json` は同期していない。
- `make rust-lint` と `make validate` の Rust authz tests は sandbox だと `Operation not permitted` で失敗したため、権限昇格で再実行した。
- Browser runtime smoke は未実施。今回の UI review は lint / typecheck / test ベースで判定した。
