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

## 2026-03-03 (widgets/legacy 廃止対応)
- `typescript/src/widgets/legacy/ui/*` を `typescript/src/widgets/<slice>/ui` へ移動し、`widgets/legacy` を削除。
- `auth-guard` は `typescript/src/widgets/auth-guard/ui/auth-guard.tsx` として再配置。
- 各 `widgets/<slice>/index.ts` を追加し、Public API をスライス単位で公開。
- `@/widgets/legacy/ui/*` import を新構造へ置換:
  - ルート参照: `@/widgets/<slice>`
  - 深い参照: `@/widgets/<slice>/ui/...`
- widget 間参照の一部を Public API 経由に整理:
  - 例: `panels` → `threads`, `modals` → `user-profile`
- `typescript/eslint.config.mjs` の緩和対象を `src/widgets/legacy/**/*` から `src/widgets/**/*` に更新。
- 検証:
  - `cd typescript && npm run typecheck` ✅
  - `cd typescript && npm run lint` ✅

## 2026-03-03 (理想系へ再配置 + FSDチェック導入)
- `widgets` 偏重を解消するため、下記スライスを `widgets` から `features` へ移動:
  - `auth-guard`, `context-menus`, `dm-friends`, `forum`, `modals`, `notifications`,
    `pickers`, `settings`, `special`, `threads`, `user-profile`, `voice`
- `@/widgets/<slice>` 参照を `@/features/<slice>` へ一括置換し、`app/widgets/features` の参照整合を維持。
- `typescript/src/features/index.ts` に移動済みスライスの export を追加し、Public APIを集約。
- TypeScript専用FSDチェックを追加:
  - `typescript/scripts/check-fsd.mjs`
  - `typescript/package.json` に `fsd:check` 追加
  - `typescript/Makefile` に `fsd-check` 追加、`lint` 前に実行
  - ルート `Makefile` に `ts-fsd-check` 追加
- `typescript/eslint.config.mjs` にて、旧 `widgets` から `features` へ移動したモックUI群へ既存緩和ルールを適用。
- 検証:
  - `make ts-fsd-check` ✅
  - `cd typescript && npm run typecheck` ✅
  - `cd typescript && make lint` ✅
