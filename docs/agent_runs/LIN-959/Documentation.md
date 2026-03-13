# Documentation.md (Status / audit log)

## Current status
- Now: TypeScript 実装と対象テストは完了。サイズ超過の事前 reject と案内文を追加した。

## Decisions
- Avatar limit is `2MB`; banner limit is `6MB`.
- Oversized files are rejected before crop modal open and before upload/save.

## How to run / demo
- settings profile で avatar / banner のファイル選択ボタンを押す
- 入力下に avatar `2MB` / banner `6MB` の案内文が表示されることを確認する
- 上限超過ファイルを選ぶと crop modal が開かず、エラー表示されることを確認する
- 上限内ファイルでは既存の crop / preview / save 導線が維持されることを確認する
- 実行済み検証:
  - `cd typescript && pnpm test -- src/features/settings/ui/user/user-profile.test.tsx src/features/settings/lib/profile-image.test.ts`
  - `cd typescript && pnpm typecheck`

## Known issues / follow-ups
- `pnpm test` 実行中の `act(...)` warning は既存テスト群でも発生しており、今回の変更で新設した failure ではない
