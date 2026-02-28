# LIN-622 Documentation Log

## Status
- Completed implementation pass for LIN-622 scoped changes.
- Added principal 自動プロビジョニング、失敗分類マッピング、観測性、DB採番 migration、関連ドキュメント更新。

## Decisions
- principal_id は `users.id` DB採番（sequence default）で生成する。
- profile 初期値は token claim 優先、欠損時は UID 由来 fallback。
- email 競合は fail-close (`403`) とし、自動同一化しない。
- プロビジョニング途中失敗時は orphan user をベストエフォートで掃除し、false `403` を避けるため再解決を優先する。

## Validation results
- `cd rust && cargo clippy --workspace --all-targets --all-features -- -D warnings`: passed
- `cd rust && cargo test --workspace`: passed
- `make validate`: failed (TypeScript dependencies missing: `prettier: command not found`, `node_modules` 未展開)

## Follow-ups
- LIN-621 反映後の最終統合確認（schema 遷移面）
- Postgres 実DBを使った同時初回認証競合シナリオの専用回帰テスト追加（non-blocking）
