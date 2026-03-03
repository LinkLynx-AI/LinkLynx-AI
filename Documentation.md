# Documentation

## TypeScript FSD移行メモ

- `typescript/src` のトップレベルは `app / entities / features / shared / widgets / test` のみとし、非FSD直下ディレクトリを解消。
- 既存UI実装は変更せず、物理配置と import パスのみを更新。
- `widgets` レイヤは `widgets/<slice>/ui` の形に統一し、`widgets/legacy` は廃止。
- `widgets/<slice>/index.ts` を Public API として配置し、外部からはスライス単位の import を優先。
- 既存の mock-design 系コードに対する ESLint 緩和設定は `src/widgets/**/*` に適用して維持。

## TypeScript FSD理想系（2026-03-03 更新）

- `widgets` はレイアウト/複合表示の単位に限定:
  - `app-shell`, `channel-sidebar`, `chat`, `member-list`, `panels`, `server-list`
- ユースケース中心のスライスは `features` へ集約:
  - `auth-guard`, `context-menus`, `dm-friends`, `forum`, `modals`, `notifications`,
    `pickers`, `settings`, `special`, `threads`, `user-profile`, `voice`
- `features/index.ts` を更新し、移動したスライスをPublic APIとして再公開。
- FSD境界の自動検査を追加:
  - 実体: `typescript/scripts/check-fsd.mjs`
  - 実行: `make ts-fsd-check` または `cd typescript && make fsd-check`
  - `cd typescript && make lint` 実行時にも `fsd-check` を先行実行。
