# LIN-802 Prompt

## Goal
- v1最小限モデレーションを実装し、`report/mute` と `resolve/reopen`、FEキュー/詳細導線を動作させる。

## Non-goals
- 自動判定や外部連携の高度モデレーション。
- 管理画面全体の再設計。
- 権限モデル自体の刷新。

## Deliverables
- Rust APIにモデレーション用エンドポイント群を追加。
- Postgres migrationで最小モデレーションスキーマを追加。
- TypeScriptにモデレーションAPIクライアントとキュー/詳細UI導線を追加。

## Done when
- [x] report/mute API と audit_logs 連携が実装される。
- [x] resolve/reopen と owner/admin ロール制御が実装される。
- [x] FEで queue -> detail -> resolve/reopen/mute の導線が接続される。

## Constraints
- Security: ADR-004 fail-close（403/503契約）を維持する。
- Compatibility: event/schema は additive-only（ADR-001）を維持する。
- Scope: 1親Issue内でも out-of-scope 改善は混在させない。
