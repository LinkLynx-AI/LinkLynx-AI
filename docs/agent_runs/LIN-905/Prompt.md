# LIN-905 Prompt

## Goal
- `LIN-905` を leaf issue として完了扱いにできる証跡を作る。
- 既に `main` へ入っている認証実装を `LIN-905` の受け入れ条件へ再マッピングする。
- 不足があれば、`LIN-905` の範囲に限定して最小差分で補完する。

## Non-goals
- verify email / password reset の完了（`LIN-906` スコープ）。
- 認証 E2E スモークと運用手順の完了（`LIN-907` スコープ）。
- AuthZ 仕様変更や新しい認証方式の追加。

## Deliverables
- `docs/agent_runs/LIN-905/*` の実行ログ。
- `LIN-905` の受け入れ条件と既存実装の対応表。
- 品質ゲートと runtime smoke の結果。
- 必要時のみ、login / protected route / ws identify の最小補完差分。

## Done when
- [x] ログイン後に保護画面へ進める根拠を route-level smoke と targeted tests で再確認できる。
- [x] 認証済み導線が一貫していることを再確認できる。
- [x] `make validate` と `cd typescript && npm run typecheck` の結果を記録できる。
- [x] `LIN-905` 専用の review / validation / smoke 証跡が揃う。

## Constraints
- Security: `returnTo` は内部保護ルートのみを許可し、open redirect を入れない。
- Compatibility: 既存契約 `/protected/ping` / `/auth/ws-ticket` / `auth.identify` を維持する。
- Scope: 既存の `LIN-641` / `LIN-642` / `LIN-643` / `LIN-644` / `LIN-854` / `LIN-855` を引継ぎ元として扱い、スコープ外改善を混ぜない。
