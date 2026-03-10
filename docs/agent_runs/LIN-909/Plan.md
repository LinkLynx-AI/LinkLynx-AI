# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: validation か review で失敗したら次工程へ進まず修正する。
- `LIN-909` の範囲は profile 保存反映の完了に限定し、無関係な settings 改修は混ぜない。

## Milestones
### M1: run memory と profile 契約差分を固定
- Acceptance criteria:
  - [ ] `LIN-909` の source of truth と実装制約を run docs に記録する。
  - [ ] `avatar_key` / `banner_key` の DB・Rust・TS 契約差分を明確化する。
- Validation:
  - `rg -n "avatar_key|banner_key" rust/apps/api/src/profile rust/apps/api/src/main database/postgres`

### M2: profile 保存反映を avatar / banner まで閉じる
- Acceptance criteria:
  - [ ] profile mutation success が `auth-store` と主要 query cache に同期される。
  - [ ] `AuthBridge` が reload 後に `useMyProfile` 結果を使って session fallback を補正する。
  - [ ] settings profile preview が保存済み avatar / banner を優先表示する。
  - [ ] profile save が avatar / banner を storage upload 後に `avatarKey` / `bannerKey` として保存する。
- Validation:
  - `cd typescript && npm run test -- src/shared/api/mutations/use-my-profile.test.ts src/app/providers/auth-bridge.test.tsx src/features/settings/ui/user/user-profile.test.tsx`

### M3: 総合検証
- Acceptance criteria:
  - [ ] targeted tests / typecheck が通る。
  - [ ] Rust / DB 追加差分の回帰確認結果が残る。
  - [ ] 環境由来で未実行の gate があれば `Documentation.md` に残る。
- Validation:
  - `cd typescript && npm run typecheck`
  - `cd rust && cargo test -p linklynx_backend profile`
  - `make validate`
