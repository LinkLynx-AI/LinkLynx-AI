# Prompt.md (Spec / Source of truth)

## Goals
- 未認証ユーザーがログイン後に invite 導線へ復帰できるようにする。
- 認証済みユーザーが invite を完了したら対象サーバーへ遷移させる。

## Non-goals
- 招待管理 UI の拡張は扱わない。
- 招待 verify / join backend 契約自体は変更しない。

## Deliverables
- invite 由来の auth resume 導線
- invite 完了後の redirect 実装
- TypeScript tests

## Done when
- [x] 未認証で `/invite/{code}` に来たユーザーが login / verify-email を経由して invite flow に戻れる。
- [x] 認証済みユーザーが invite を join でき、参加後に `/channels/{guildId}` へ遷移する。
- [x] `make validate` と `cd typescript && npm run typecheck` が通る。
- [ ] child issue 用 PR を作成する。

## Constraints
- `returnTo` の protected-only 契約は壊さない。
- FSD boundary を守り、invite 固有処理は feature/shared の境界で閉じる。
