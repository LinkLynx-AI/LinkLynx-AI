# Prompt

## Goals
- auth 関連の backend/frontend 実装を探索し、レビューエージェント指摘を解消する。
- レビュー指摘のうち特に blocking (P1) を優先し、レビューOKになるまで修正を反復する。

## Non-goals
- auth 以外の機能改善。
- UI デザイン変更。

## Deliverables
- AuthZ の fail-close 方針に沿った runtime 挙動。
- auth 関連エンドポイントの保護強化。
- frontend 認証状態同期とエラー分類の不整合修正。
- 追加/更新テストとその実行結果。

## Done when
- [ ] reviewer 指摘の blocking finding が解消されている。
- [ ] auth 関連の追加/更新テストが通過している。
- [ ] reviewer 再実行で重大指摘がなくなる。

## Constraints
- Perf: auth 処理のホットパスで不要な追加処理を避ける。
- Security: ADR-004 fail-close 方針を満たす。
- Compatibility: auth API 契約を壊さない（必要最小限の挙動修正のみ）。
