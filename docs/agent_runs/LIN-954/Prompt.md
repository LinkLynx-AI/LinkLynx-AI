# Prompt

## Goals
- LIN-954 として role/member override/authz apply の主要回帰を自動テストとローカル検証手順へ落とし込む。
- `AUTHZ_PROVIDER=spicedb` 前提の role 更新 -> tuple sync / invalidation -> permission snapshot / 実操作反映の確認手順を明文化する。

## Non-goals
- 新しい E2E 基盤導入
- runbook の全面刷新
- role 機能と無関係な既存テスト整理

## Deliverables
- brittle edge を固定する追加テスト
- runbook / Documentation 更新
- docs/agent_runs/LIN-954/*

## Done when
- [x] allow / deny / unavailable の主要境界が自動テストで検知できる
- [x] local SpiceDB を使った最小検証手順が runbook に残っている
- [x] role 更新から snapshot / 実操作反映までの観察ポイントが追える
- [x] relevant validation が通る

## Constraints
- 既存 runbook 構造は維持する
- backend/frontend の既存 contract を変えない
- 実装済み child issue の scope を巻き戻さない

## Outcome
- `channel-edit-permissions.test.tsx` に `AUTHZ_UNAVAILABLE` 時の guard screen 回帰を追加した。
- local runtime runbook に role/member/override 更新後の propagation smoke を追記した。
- tuple sync operations runbook に LIN-949 flow 向け triage を追記した。
