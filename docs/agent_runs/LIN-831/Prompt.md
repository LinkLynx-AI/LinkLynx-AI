# Prompt.md (Spec / Source of truth)

## Goals
- message の inline edit/delete を frontend から実行できるようにする。
- 競合や権限エラー時に query cache を再同期し、UI が壊れないようにする。

## Non-goals
- UI 全面変更はしない。
- backend contract の追加変更はしない。

## Deliverables
- edit/delete 用 API client 実装
- optimistic update / rollback を含む mutation 実装
- message hover action / context menu / tombstone 表示の更新
- run memory と test 更新

## Done when
- [ ] 編集/削除操作が message UI から実行できる
- [ ] 409 / 権限エラー時に cache 再同期とエラー表示が行われる
- [ ] tombstone 表示と WS/list snapshot が矛盾しない

## Constraints
- Perf: query cache は対象 channel のみ更新する
- Security: author-only 操作と fail-close 前提を崩さない
- Compatibility: ADR-001 に従い additive 変更のみ
