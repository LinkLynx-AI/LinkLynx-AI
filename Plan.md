# Plan

1. `docs/TYPESCRIPT.md` を読み、現行構造との差分を把握する。 ✅
2. 非FSDトップレベル (`components/hooks/lib/providers/services/stores/types`) をFSDレイヤ配下に再配置する。 ✅
3. 全importを新パスへ一括更新する。 ✅
4. ESLint設定の対象パスを新構造に合わせる。 ✅
5. TypeScript typecheck / lint で参照整合性を確認する。 ✅
