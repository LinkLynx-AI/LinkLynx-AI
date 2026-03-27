# Prompt

## Goals
- LIN-953 として frontend settings の roles/members/channel permissions 導線を実 API と permission snapshot に接続する。
- mock 前提 state を最小限に置き換え、fail-close な disabled/guard 表現を contract に揃える。

## Non-goals
- settings 全体のリデザイン
- backend contract の変更
- E2E 回帰全体

## Deliverables
- LIN-953 実装に対応する frontend query/mutation/model/ui 差分
- component/query/interaction test
- docs/agent_runs/LIN-953/*

## Done when
- [x] roles/members/channel permissions が実 API で読めて更新できる
- [x] permission snapshot / RouteGuard に沿って禁止・unavailable が fail-close で出る
- [x] tri-state allow/deny/inherit と backend DTO が一致する
- [x] relevant frontend tests と typecheck が通る

## Constraints
- FSD/Public API を破らない
- deep import を増やさない
- role 機能外の導線は触らない
