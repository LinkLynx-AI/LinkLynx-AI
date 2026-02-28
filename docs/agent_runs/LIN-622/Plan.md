# LIN-622 Plan

## Milestones
1. `users.id` DB採番の migration を追加（既存IDと衝突しない sequence 同期）。
2. Auth 境界を拡張し、`VerifiedToken` claim を使って専用プロビジョニング境界へ委譲。
3. Principal resolver/store に自動プロビジョニング（冪等 + 競合収束 + 失敗分類）を実装。
4. 観測性を追加（プロビジョニング成功/失敗/再試行メトリクス + 監査ログ）。
5. テスト追加（正常/重複/競合/DB障害/既存mapping回帰）。
6. ドキュメント更新（DB契約、auth runbook、run memory）。

## Validation commands
- `cd rust && cargo fmt --all`
- `cd rust && cargo clippy --workspace --all-targets --all-features -- -D warnings`
- `cd rust && cargo test --workspace`
- `make validate`（可能なら実行、失敗時は要因を記録）

## Acceptance checks
- unmapped UID 初回認証が `200` で通り、同一 UID は同一 principal に収束する。
- 競合解消不可は `AUTH_PRINCIPAL_NOT_MAPPED` (`403`)。
- DB障害は `AUTH_UNAVAILABLE` (`503`)。
- 入力不正は `AUTH_INVALID_TOKEN` (`401`)。
