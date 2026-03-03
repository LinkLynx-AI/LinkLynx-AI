# Implement

## 2026-03-03
- `docs/TYPESCRIPT.md` を確認し、FSDレイヤ要件を基準に移行方針を確定。
- 以下の非FSDトップレベルをFSDレイヤ配下へ移動:
  - `typescript/src/components/ui` → `typescript/src/shared/ui/legacy`
  - `typescript/src/components/*` (ui除く) → `typescript/src/widgets/legacy/ui/*`
  - `typescript/src/hooks` → `typescript/src/shared/model/legacy/hooks`
  - `typescript/src/lib` → `typescript/src/shared/lib/legacy`
  - `typescript/src/services` → `typescript/src/shared/api/legacy`
  - `typescript/src/stores` → `typescript/src/shared/model/legacy/stores`
  - `typescript/src/types` → `typescript/src/shared/model/legacy/types`
  - `typescript/src/providers` → `typescript/src/app/providers`
- 全 `@/components|hooks|lib|providers|services|stores|types` import を新パスへ一括更新。
- `typescript/eslint.config.mjs` の許可パス/緩和対象を新ディレクトリ構造へ更新。
- 検証:
  - `cd typescript && npm run typecheck` ✅
  - `cd typescript && npm run lint` ✅
