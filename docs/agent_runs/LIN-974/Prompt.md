# Prompt.md (Spec / Source of truth)

## Goals
- `LIN-974` として standard path の incident / postmortem / capacity baseline を整備する。
- `LIN-968`〜`LIN-975` の前提を使って、初期 on-call flow、capacity assumptions、拡張トリガー、Chaos readiness を文書化する。
- Discord mention を含む incident flow と reusable な postmortem template を追加する。

## Non-goals
- PagerDuty / Opsgenie などの on-call SaaS 導入
- multi-region / multi-cloud DR の本実装
- Chaos Engineering の自動実行や fault injection 実装

## Deliverables
- standard incident operations runbook
- standard postmortem template
- infra / environment / decisions docs 更新
- `docs/agent_runs/LIN-974/` memory

## Done when
- [x] 初期 capacity assumptions と拡張トリガーが文書化されている
- [x] Discord mention を含む incident flow が runbook 化されている
- [x] standard path 用の postmortem template が利用可能である
- [x] Chaos Engineering の開始条件が readiness 条件で記載されている
- [x] `make validate` が通る
- [x] `git diff --check` が通る

## Constraints
- Perf: 登録者数ではなく observed traffic / latency / DB pressure を優先指標にする
- Security: incident flow は既存の standard observability / security posture を前提にし、fail-open な運用にしない
- Compatibility: low-budget runbook と競合させず、standard path の full operating model として分離する
