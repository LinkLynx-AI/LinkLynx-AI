# Prompt.md

## User request
- `LIN-969` を実装する
- standard path 向けに Dragonfly の隔離配置と persistence baseline を整備する

## Constraints
- 1 issue = 1 PR
- ADR-005 と session/resume contract に従う
- low-budget `dragonfly_minimal` とは混ぜない

## Success target
- standard path 用 Dragonfly StatefulSet module が追加されている
- staging / prod root に opt-in wiring が追加されている
- isolation / recovery / rollback の runbook が追加されている
