# LIN-860 Prompt

## Goal
- `LIN-860` の子Issue（`LIN-861` から `LIN-868`）を順次実行し、SpiceDB認可基盤移行を完了する。
- すべて `1 issue = 1 PR` で実施し、子Issueごとに検証・レビュー・証跡を残す。
- `AUTHZ_PROVIDER=spicedb` 実装までの経路を ADR-004 fail-close 契約に整合させる。

## Non-goals
- 複数子Issueの同時実装。
- AuthN方式そのものの再設計。
- Issueスコープ外の横断的リファクタ。

## Done conditions
- 各子Issueで受け入れ条件を満たし、PRと証跡（検証結果、レビュー結果、UI gate結果）を記録する。
- 親Issueの順序（861 -> 868）を崩さない。
- 主要ドキュメント（AuthZ/ADR/Runbook/DB契約）との整合性を維持する。
