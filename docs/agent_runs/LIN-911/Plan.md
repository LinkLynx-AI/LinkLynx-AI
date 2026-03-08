# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: if validation fails, repair it before moving to the next step.
- `LIN-911` の範囲外である join API / login 復帰導線 / post-join 遷移は混ぜない。

## Milestones
### M1: Rust public invite verify endpoint を追加
- Acceptance criteria:
  - [ ] `GET /v1/invites/{invite_code}` が public で利用できる。
  - [ ] `valid / invalid / expired` 判定を `invites` テーブルから返せる。
  - [ ] runtime 未構成時は fail-close で `503` を返す。
- Validation:
  - `cargo test -p linklynx_api invite`

### M2: TypeScript invite gateway と `/invite/[code]` を追加
- Acceptance criteria:
  - [ ] API provider が invite verify response を parse して `InvitePageContent` を返す。
  - [ ] `/invite/[code]` が状態ごとに表示を切り替える。
  - [ ] no-data provider でも新契約を満たす。
- Validation:
  - `cd typescript && npm run test -- src/entities/ui-gateway/api/create-ui-gateway.test.ts src/shared/config/routes.test.ts`
  - `cd typescript && npm run typecheck`

### M3: 総合検証とレビュー準備
- Acceptance criteria:
  - [ ] required validations が通る。
  - [ ] review gate 用の根拠が揃う。
- Validation:
  - `make validate`
  - `make rust-lint`
  - `cd typescript && npm run typecheck`
