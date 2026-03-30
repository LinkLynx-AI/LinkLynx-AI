# Prompt.md (Spec / Source of truth)

## Goals
- `LIN-972` として standard path 向けの observability baseline を整備する。
- `staging` / `prod` の standard GKE path に、self-hosted observability stack を Terraform で追加する。
- cluster / deploy / Cloud SQL / Dragonfly / Scylla / messaging の最低監視を用意する。
- Discord を初期 alert route としてつなぎ、API / WebSocket の SLO dashboard を Grafana で見られる状態にする。

## Non-goals
- アプリ側の full instrumentation 拡張
- managed provider 由来の deep metrics ingestion
- tracing backend 本実装
- on-call SaaS 連携

## Deliverables
- `infra/modules/observability_standard_baseline`
- `staging` / `prod` 環境への module wiring
- standard observability runbook
- infra / decisions / environment README 更新

## Done when
- [x] standard path に observability baseline module が追加されている
- [x] `staging` / `prod` の standard path から opt-in で有効化できる
- [x] Discord webhook, API probe, messaging probe の前提チェックが Terraform に入っている
- [x] `terraform fmt -check -recursive infra` が通る
- [x] `PATH=/tmp/terraform_1.6.6:$PATH make infra-validate` が通る
- [x] `make validate` が通る

## Constraints
- Perf: baseline issue なので retained storage と single-binary Loki を採用し、重い拡張は follow-up に送る
- Security: Discord webhook は Git に入れず Terraform input で注入する
- Compatibility: 既存の standard path modules に依存し、low-budget path とは責務を分離する
