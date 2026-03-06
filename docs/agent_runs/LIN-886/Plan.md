# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: 検証またはレビューで blocking が出たら次工程へ進まず修正する。
- Scope lock: LIN-886 の avatar / banner 保存反映に限定し、別機能の改善を混ぜない。

## Milestones
### M1: 契約拡張
- Acceptance criteria:
  - [x] `banner_key` を DB / Rust / TypeScript 境界へ追加
  - [x] 既存 profile API 契約を additive に維持
- Validation:
  - `cargo test --manifest-path rust/Cargo.toml -p linklynx_backend profile::tests my_profile`

### M2: フロント保存フロー
- Acceptance criteria:
  - [x] avatar / banner の Firebase Storage upload + profile PATCH が成立
  - [x] save 成功 / 失敗 UI と retry が成立
- Validation:
  - `npm -C typescript run test -- src/shared/api/guild-channel-api-client.test.ts src/features/settings/ui/user/user-profile.test.tsx src/app/providers/auth-bridge.test.tsx`

### M3: 再反映と最終検証
- Acceptance criteria:
  - [x] reload / relogin 後に user panel へ保存済み avatar が反映
  - [x] review / validation evidence を記録
- Validation:
  - `cd typescript && npm run typecheck`
  - `make validate`
  - `reviewer`
  - `reviewer_ui_guard`
