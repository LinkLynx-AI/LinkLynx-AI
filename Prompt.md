# Prompt

## Goals
- `LIN-796` の親要件に対して、現行 `main` に未実装差分が残っているかを確認する。
- 追加差分がなければ、既存実装を前提に完了判断できる状態へ作業記録を揃える。

## Non-goals
- 既に `main` に存在する invite verify / join / FE 導線の再実装。
- 新規仕様追加や invite 契約変更。

## Deliverables
- `LIN-796` 向けの `Prompt.md` / `Plan.md` / `Implement.md` / `Documentation.md` 更新。
- 現状確認の根拠整理。
- 実行できた検証結果と、環境依存で未実行の検証の明確化。

## Done when
- [x] `LIN-796` の子課題相当実装が既存コードに存在することを確認する。
- [x] `codex/lin-796` が `origin/main` と差分 `0/0` であることを確認する。
- [x] root memory files が `LIN-796` の内容に更新されている。
- [ ] frontend 依存導入済み環境で `make validate` と `cd typescript && npm run typecheck` を再確認する。

## Constraints
- invite verify / join の AuthN/AuthZ 契約は ADR-004 に従い維持する。
- invite access の rate-limit outage policy は ADR-005 に従い維持する。
- 追加要件や不具合再現が無い限り、repo-tracked の product code は変更しない。
