# LIN-632 Prompt

## Goal
- 固定3ロール依存（`owner/admin/member`）から脱却できる任意ロールDB設計を追加する。
- SpiceDB移行を前提に、Postgres権限データからtupleへ写像する契約を文書化する。
- 移行フェーズ（backfill -> dual-write -> cutover -> rollback）を定義する。

## Non-goals
- SpiceDBクライアント実装。
- AuthZエンジンの全面置換。
- 既存APIの全面刷新。

## Done conditions
- 任意ロール作成/複数ロール割当を保存できる新スキーマが追加される。
- Postgres -> SpiceDB tuple写像表が契約文書として追加される。
- 移行フェーズと互換方針が追跡可能な文書として追加される。
