# LIN-860 Plan

## Milestones
1. `LIN-861`: 既存API棚卸しと権限マトリクス確定（Public/Protected境界固定）。
2. `LIN-862`: SpiceDB権限モデル（namespace/relation/permission）設計固定。
3. `LIN-863`: SpiceDB実行基盤（local/CI）整備。
4. `LIN-864`: Postgres -> SpiceDB tuple写像と同期実装。
5. `LIN-865`: `AUTHZ_PROVIDER=spicedb` 実装と fail-close 接続。
6. `LIN-866`: Guild/Channel/Message 系RESTの権限適用。
7. `LIN-867`: Invite/DM/Moderation/WS の権限適用。
8. `LIN-868`: 統合テスト・観測・cutover/rollback整備。

## Per-child delivery loop
1. 子Issue専用ブランチ作成。
2. 実装。
3. 小さい論理単位でコミット。
4. 検証実行。
5. `reviewer_simple` 実行。
6. `reviewer_ui_guard` 実行（必要時 `reviewer_ui`）。
7. PR作成（base: `codex/lin-860`）。
8. マージ方針に従って完了。
9. `Documentation.md` へ証跡記録。

## Validation commands
- `make validate`
- `make rust-lint`
- `cd typescript && npm run typecheck`（TypeScript差分がある場合）

## Acceptance checks (global)
- ADR-004 fail-close 境界（deny/unavailable）が維持される。
- 追加変更は additive / backward-compatible を維持する。
- 子Issueごとに evidence が欠落しない。
