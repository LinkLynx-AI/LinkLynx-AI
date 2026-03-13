# Prompt

## Goals
- message v1 contract runbook の Draft 項目を tracked follow-up として固定する。
- current v1 delivery gate と次期対応項目の境界を文書化する。
- follow-up owner / target date / traceability を残す。

## Non-goals
- message edit/delete 実装そのもの。
- durable event transport の実装拡張。
- REST/WS contract shape の変更。

## Deliverables
- `docs/runbooks/message-v1-api-ws-contract-runbook.md` の follow-up 明文化。
- `docs/V1_TRACEABILITY.md` の対応行追加。
- LIN-981 run memory。

## Done when
- [ ] runbook に follow-up owner と next target date が入る
- [ ] current v1 delivery gate から follow-up が除外されることが明文化される
- [ ] traceability に追跡行が追加される

## Constraints
- 現行 v1 baseline と follow-up を混同しない。
- 口頭メモではなく repo 上の追跡可能な文書へ残す。
