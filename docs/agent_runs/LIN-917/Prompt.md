# Prompt.md (Spec / Source of truth)

## Goals
- reply / pin / reaction のうち、v1 で成立している範囲と未接続の範囲を UI と docs で一致させる。
- fake preview や mock detail のような誤解を招く表示をなくす。
- `LIN-892` 親完了判断に必要な状態整理を `LIN-917` に集約する。

## Non-goals
- reply create / pin API / reaction API 自体の新規実装
- event schema や message REST/WS 契約の拡張
- スレッド機能の実装

## Deliverables
- frontend の reply / pin / reaction 導線整理
- `docs/agent_runs/LIN-917/` の memory 一式
- PR 用の要約と検証記録

## Done when
- [ ] 未接続の操作が接続済みのように見えない
- [ ] reply / pin / reaction の Done / 未接続が docs に残る

## Constraints
- Perf: 既存 timeline / message render の回帰を出さない
- Security: 既存 authz / API 契約は変えない
- Compatibility: additive 以外の契約変更はしない
