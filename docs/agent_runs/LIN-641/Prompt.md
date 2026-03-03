# LIN-641 Prompt

## Goal
- 既存の `login/register/verify-email/password-reset` 画面を Firebase Auth 実処理に接続する。
- 各画面で主要成功/失敗シナリオの分岐を実装し、UI 上で確認可能にする。
- verify 未完了ユーザーを `verify-email` へ明確に誘導する。

## Non-goals
- UI 全面改修。
- REST 認証橋渡し (`authenticatedFetch`) や保護ルート強制リダイレクト（LIN-642 スコープ）。
- 独自 password reset 基盤の追加。

## Deliverables
- `entities/auth` に Firebase 認証操作 API とエラー正規化層。
- `features/auth-flow` に 4 画面用フォーム/パネル UI とバリデーション。
- `app/(auth)` 4ページの Firebase 実接続。
- `docs/agent_runs/LIN-641/*` の実行ログ。

## Done conditions
- login/register/verify/reset の主要成功シナリオが成立する。
- 主要失敗シナリオ（資格情報不正・メール未確認・無効入力）で適切な表示分岐がある。
- フォーム操作から Firebase 処理が実行される。
- `cd typescript && npm run typecheck` / `cd typescript && npm run test` が通過する。

## Fixed decisions
- login/register で未確認メールの場合は `verify-email` へ遷移する。
- password reset はアカウント列挙防止のため送信結果を同一文言で表示する。
