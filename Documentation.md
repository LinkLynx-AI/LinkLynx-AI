# Documentation

## TypeScript FSD移行メモ

- `typescript/src` のトップレベルは `app / entities / features / shared / widgets / test` のみとし、非FSD直下ディレクトリを解消。
- 既存UI実装は変更せず、物理配置と import パスのみを更新。
- `widgets` レイヤは `widgets/<slice>/ui` の形に統一し、`widgets/legacy` は廃止。
- `widgets/<slice>/index.ts` を Public API として配置し、外部からはスライス単位の import を優先。
- 既存の mock-design 系コードに対する ESLint 緩和設定は `src/widgets/**/*` に適用して維持。
