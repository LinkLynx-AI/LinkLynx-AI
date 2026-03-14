# Prompt.md (Spec / Source of truth)

## Goals
- LIN-940 の child issue で完了した channel category 実装を parent issue として `main` に反映する。
- `LIN-944` の回帰試験・検証手順差分を `main` 向けの最終 PR として整理する。
- 親 issue の最終 evidence を `docs/agent_runs/LIN-940/` に残す。

## Non-goals
- 既に merge 済みの LIN-941 / LIN-942 / LIN-943 実装を再編集しない。
- channel category 機能の追加仕様や refactor を混ぜない。
- `main` への直接 push や human approval を飛ばした merge をしない。

## Deliverables
- `origin/main` ベースの parent integration branch
- `LIN-944` 回帰差分のみを含む `main` 向け PR
- 親 issue の実行記録（Prompt / Plan / Implement / Documentation）

## Done when
- [ ] `LIN-944` 差分のみが `main` 向け branch に載っている
- [ ] review / validation evidence が記録されている
- [ ] `main` 向け PR が日本語 title/body で作成されている

## Constraints
- Perf: 既存 validation コマンドを優先し、不要な再実装はしない。
- Security: `main` への操作はユーザー承認済み範囲だけで行う。
- Compatibility: 既に merge 済み child PR と同じ差分以外を混ぜない。
