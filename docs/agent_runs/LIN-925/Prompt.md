# LIN-925 Prompt

## Goals
- v1 範囲の permission snapshot 契約を固定する。
- FE が 1 リクエストで必要な操作可否を取得できる最小 I/F を追加する。
- `LIN-926` の ActionGuard/API 判定整合に渡せる backend/frontend 契約を先に揃える。

## Non-goals
- ActionGuard UI 実装の適用。
- 既存非 `v1` API の AuthZ 整合修正全般。
- 権限モデルの全面刷新。

## Deliverables
- permission snapshot 契約文書。
- backend snapshot endpoint。
- frontend 型定義と取得 hook / client。
- 契約テストと回帰テスト。

## Done when
- [x] snapshot response shape が文書化されている
- [x] backend で snapshot を取得できる
- [x] frontend で 1 リクエスト取得用の client/hook が利用可能
- [x] `make validate` と追加テスト結果が記録されている

## Constraints
- Perf: snapshot は 1 リクエストで完結し、無駄な追加 API 呼び出しを要求しない
- Security: unavailable を暗黙 false に潰さず fail-close を守る
- Compatibility: additive only
