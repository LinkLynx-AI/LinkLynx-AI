# Documentation.md (Status / audit log)

## Current status
- Now: TypeScript 実装と回帰テストは完了。frontend 側の保存反映導線は通った。
- Next: `make validate` の Python 環境依存失敗を切り分けたので、必要なら環境整備後に full validate を再実行する。

## Decisions
- backend / DB の追加変更は入れず、`LIN-939` の契約を reuse する
- self avatar の即時反映は `auth-store` と query cache の patch で行う
- banner の即時反映は settings preview と persisted key の再解決で賄う
- upload 済み object の cleanup API は現状ないため、PATCH 失敗時も frontend 側から削除しない

## How to run / demo
- 設定画面プロフィールで avatar / banner を選択して crop する
- `変更を保存` を押し、保存成功後に preview と左下 user panel が更新されることを確認する
- ページ再読込後も avatar / banner が復元されることを確認する
- 実行済み検証:
  - `cd typescript && pnpm install --frozen-lockfile`
  - `cd typescript && pnpm test -- src/shared/api/mutations/use-my-profile.test.ts src/app/providers/auth-bridge.test.tsx src/features/settings/ui/user/user-profile.test.tsx`
  - `cd typescript && pnpm typecheck`
- 追加確認:
  - `cd typescript && make validate` は `eslint` 実行まで進むが、この環境では完走確認前に停止した
  - repo root の `make validate` は `python/Makefile` の `ensure-dev-tools` で `/usr/bin/python3: No module named pip` により失敗した

## Known issues / follow-ups
- uploaded object cleanup API は未実装のため、PATCH 失敗後の orphan object cleanup は今回扱わない
- root `make validate` はコード不備ではなくローカル Python 3.8 環境の `pip` / `ensurepip` / `distutils` 欠落でブロックされた
