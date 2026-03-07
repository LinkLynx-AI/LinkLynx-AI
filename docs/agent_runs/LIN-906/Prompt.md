# LIN-906 Prompt

## Goal
- `verify email` と `password reset` の最小 end-to-end を `LIN-906` として閉じる。
- 既存の Firebase 接続済み UI を見直し、受け入れ条件の「失敗時に再試行導線がある」を明示する。
- `LIN-906` 専用の検証・runtime smoke・review 証跡を残す。

## Non-goals
- 外部 IdP の追加。
- 認証 E2E 全体と運用手順の完了（`LIN-907` スコープ）。
- login / protected route / ws identify の追加変更（`LIN-905` スコープ）。

## Deliverables
- `docs/agent_runs/LIN-906/*` の実行ログ。
- `password-reset` の再試行導線を明示する最小 UI 改善。
- `verify-email` / `password-reset` の回帰テスト。

## Done when
- [ ] `verify email` と `password reset` が既存 Firebase 実装と整合した形で動く。
- [ ] `password reset` に再試行導線が明示される。
- [ ] `make validate` と `cd typescript && npm run typecheck` が通る。
- [ ] `LIN-906` 専用の validation / runtime smoke / review 証跡が揃う。

## Constraints
- Security: password reset は列挙防止のため送信結果の扱いを変えすぎない。
- Compatibility: Firebase 標準の verify/reset へ委譲する契約を維持する。
- Scope: `verify-email` の既存自動確認ロジックは壊さず、必要最小限の差分に限定する。
