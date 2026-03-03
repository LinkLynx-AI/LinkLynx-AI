# Plan

1. `docs/TYPESCRIPT.md` を読み、現行構造との差分を把握する。 ✅
2. 非FSDトップレベル (`components/hooks/lib/providers/services/stores/types`) をFSDレイヤ配下に再配置する。 ✅
3. 全importを新パスへ一括更新する。 ✅
4. ESLint設定の対象パスを新構造に合わせる。 ✅
5. TypeScript typecheck / lint で参照整合性を確認する。 ✅

## Follow-up (widgets/legacy廃止)

1. `typescript/src/widgets/legacy` の中身を `widgets/<slice>/ui` へ再配置する。 ✅
2. `@/widgets/legacy/ui/*` import を新しい `widgets` スライス参照へ置換する。 ✅
3. `widgets` 各スライスに Public API (`index.ts`) を用意する。 ✅
4. `eslint.config.mjs` の `legacy` 前提パスを新構成へ更新する。 ✅
5. TypeScript typecheck / lint を再実行する。 ✅

## Follow-up (理想系化)

1. `widgets` のうちユースケース中心スライスを `features` へ再配置する。 ✅
2. `@/widgets/<slice>` import を `@/features/<slice>` に一括更新する。 ✅
3. `features/index.ts` で再配置スライスの Public API を公開する。 ✅
4. TypeScript専用の FSD境界チェックを追加し、`make ts-fsd-check` で実行可能にする。 ✅
5. `fsd-check / typecheck / lint` で整合性を確認する。 ✅
