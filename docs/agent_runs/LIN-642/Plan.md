# LIN-642 Plan

## Rules
- Validation 失敗時は次工程へ進む前に修正する。
- LIN-642 スコープ外（認証外API拡張、SSRガード）を混ぜない。

## Milestones
### M1: REST認証橋渡し境界 (`authenticatedFetch`) を追加
- Acceptance criteria:
  - [ ] Firebase IDトークンをBearer付与してfetch実行できる。
  - [ ] 未認証/トークン取得失敗/ネットワーク失敗を型付きで返せる。
  - [ ] principal provisioning は `authenticatedFetch` を利用する。
- Validation:
  - `cd typescript && npm run test -- src/entities/auth/api/authenticated-fetch.test.ts src/entities/auth/api/principal-provisioning.test.ts`
  - `cd typescript && npm run typecheck`

### M2: 保護ルート実ガード + `/login` 誘導を実装
- Acceptance criteria:
  - [ ] 保護ルートで `authenticated` 時に `/protected/ping` 判定を行う。
  - [ ] 401 は `/login?returnTo=...` へ誘導する。
  - [ ] 403 は forbidden、503 は service-unavailable を表示する。
  - [ ] preview query (`guard`, `state`) 互換を維持する。
- Validation:
  - `cd typescript && npm run test -- src/features/route-guard/ui/protected-preview-gate.test.tsx src/features/route-guard/ui/route-guard-screen.test.tsx`
  - `cd typescript && npm run typecheck`

### M3: returnTo導線とルート契約テストを追加
- Acceptance criteria:
  - [ ] `/login` が `returnTo` / `reason` を解釈し、ログイン成功後に復帰できる。
  - [ ] `verify-email` 導線でも `returnTo` を引き継げる。
  - [ ] route判定テーブル（public/auth/protected）と `invite` 非保護をテスト固定できる。
- Validation:
  - `cd typescript && npm run test -- src/shared/config/routes.test.ts src/features/auth-flow/model/route-builder.test.ts`
  - `cd typescript && npm run typecheck`

### M4: 総合検証
- Acceptance criteria:
  - [ ] TypeScript 全テストと型検査が通る。
- Validation:
  - `cd typescript && npm run test`
  - `cd typescript && npm run typecheck`
