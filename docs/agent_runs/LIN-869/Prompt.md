## Goals
- LIN-869 の親Issueとして、子Issueを1件ずつ実装・検証・レビュー反復し、親branchへ順次取り込む。
- ADR-004 fail-close契約および既存AuthZ契約を維持したまま、SpiceDB関連の再レビュー指摘を解消する。

## Non-goals
- 子Issueスコープ外のリファクタやCI全面刷新。
- 認可モデルの大幅再設計。

## Deliverables
- LIN-873, 883, 875, 874, 882, 881, 876, 884 の順次実装成果。
- 各子Issueの検証・レビュー証跡。
- 親branch `codex/lin-869-patch-spicedb_review_result` への統合。

## Done when
- [ ] 各子Issueが1 issue=1 branch/PR単位で完了し親branchへ取り込み済み
- [ ] 必須検証 (`make validate`, `make rust-lint` + issue固有テスト) が記録済み
- [ ] reviewer gateで重大所見(P1+)が0件

## Constraints
- Perf: 既存CI時間とランタイム特性を不必要に悪化させない
- Security: ADR-004 fail-close、REST/WS契約維持
- Compatibility: additive中心、既存APIエラー契約を保持
