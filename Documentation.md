# Documentation

## TypeScript FSD移行メモ

- `typescript/src` のトップレベルは `app / entities / features / shared / widgets / test` のみとし、非FSD直下ディレクトリを解消。
- 既存UI実装は変更せず、物理配置と import パスのみを更新。
- 既存の mock-design 系コードに対する ESLint 緩和設定は `legacy` 配下へ移譲して維持。
