# Documentation.md (Status / audit log)

## Current status
- Now: `origin/main` を取り込み、`theme` 同期と avatar/banner 保存反映が両立するよう競合を解消した。
- Next: review 証跡を更新し、PR #1182 の `DIRTY` 状態を解消した head を push する。

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
  - repo root の `make validate` は TypeScript format/lint まで進む
  - 同コマンド中の `cd python && make format` はローカル環境で `/bin/sh: 1: -m: not found` と `m: Command not found` により失敗する
  - `pnpm test` 実行中の `act(...)` warning は既存テスト由来で、失敗にはなっていない

## Known issues / follow-ups
- uploaded object cleanup API は未実装のため、PATCH 失敗後の orphan object cleanup は今回扱わない
- root `make validate` の Python 側失敗は今回の TypeScript 変更とは独立したローカル実行環境依存として扱う
