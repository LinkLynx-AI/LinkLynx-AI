# LIN-905 Plan

## Rules
- 変更は `LIN-905` の受け入れ条件に直接関係するものだけに限定する。
- 検証で失敗が出たら、次へ進む前に原因を `Documentation.md` に残す。

## Milestones
### M1: 受け入れ条件と既存実装の対応を固定する
- Acceptance criteria:
  - [x] `LIN-905` の要求を login / protected route / ws identify に分解できる。
  - [x] 引継ぎ元 issue と現在のコード上の実装位置を特定できる。
  - [x] 不足がコード差分か証跡不足かを判定できる。
- Validation:
  - `rg -n "protected/ping|auth.identify|ws-ticket|returnTo|verify-email" typescript rust docs/agent_runs`

### M2: 必要な差分を補完し、品質ゲートを通す
- Acceptance criteria:
  - [x] 不足があれば `LIN-905` の範囲だけを修正する。
  - [x] TypeScript / Rust の関係テストを再実行する。
  - [x] `make validate` と `cd typescript && npm run typecheck` の結果を記録する。
- Validation:
  - `make validate`
  - `make rust-lint`
  - `cd typescript && npm run typecheck`
  - `cd typescript && npm run test -- src/entities/auth/api/authenticated-fetch.test.ts src/entities/auth/api/principal-provisioning.test.ts src/features/route-guard/ui/protected-preview-gate.test.tsx src/features/route-guard/ui/protected-preview-gate.browser.test.tsx src/features/route-guard/ui/route-guard-screen.test.tsx src/features/auth-flow/model/route-builder.test.ts src/app/providers/ws-auth-bridge.test.tsx src/entities/auth/api/ws-ticket.test.ts`

### M3: Runtime smoke と review 証跡を閉じる
- Acceptance criteria:
  - [x] route-level smoke と targeted tests の組み合わせで login / protected route / ws identify を確認できる。
  - [x] review gate 結果または fallback 判断を残せる。
  - [x] PR 用の根拠を `Documentation.md` に集約できる。
- Validation:
  - `make dev`
  - route-level smoke for `/login` and protected route
