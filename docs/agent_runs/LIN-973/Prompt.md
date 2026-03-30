# Prompt.md (Spec / Source of truth)

## Goals
- `LIN-973` として、standard path 向けのセキュリティ統制 baseline を整備する。
- `staging` / `prod` の standard path で edge / CI / cluster / IAM / secret の最小 security control を揃える。
- WAF / DDoS / dependency / IaC / application / image の最低限の scan と運用境界を codify する。

## Non-goals
- private control plane や `master_authorized_networks` まで含む cluster access 再設計
- full compliance / governance program
- authenticated full-browser DAST の常時 merge gate 化
- AuthN/AuthZ runtime の再実装

## Deliverables
- standard GitOps canary-smoke への `Cloud Armor` attach manifest
- CI security baseline の拡張
- manual DAST baseline workflow
- standard security operations runbook
- infra / environment / runbook docs 更新
- `docs/agent_runs/LIN-973/` memory 一式

## Done when
- [x] edge 側の WAF / DDoS baseline が standard path workload に有効化されている
- [x] CI で dependency / IaC / application scan が走り、image scan 導線も documented baseline として揃う
- [x] cluster / IAM / secret の監査方針が明文化されている
- [x] fail-close / fail-open の境界が文書化されている
- [x] `terraform fmt -check -recursive infra` が通る
- [x] `PATH=/tmp/terraform_1.6.6:$PATH make infra-validate` が通る
- [x] `make infra-gitops-validate` が通る
- [x] `make validate` が通る

## Constraints
- Security: 誤検知が高い scan は merge-blocking にしない。manual / staging gate へ逃がす。
- Compatibility: ADR-004 / ADR-005 と standard path 既存 baseline を壊さない。
- Scope: runtime app logic の修正は混ぜず、security control baseline に限定する。
