# LIN-644 Documentation

## Current status
- Now: 実装・検証完了
- Next: PR作成

## Decisions
- `1008` は signOut + `/login?reason=session-expired` へ誘導。
- `1011` はバナー表示 + 手動再試行 + 指数バックオフ再接続。
- WS接続は protected route のみで開始。
- `POST /auth/ws-ticket` の `403` 系（`AUTH_EMAIL_NOT_VERIFIED` / `AUTH_PRINCIPAL_NOT_MAPPED`）は再試行せず login 遷移。
- `AUTH_UNAVAILABLE` と transport 失敗は `temporarily-unavailable` として再試行対象に分類。
- `connect` は単一フライト制御（generation + in-flight）で多重接続を防止。
- バナーは `role="status"` + `aria-live="polite"` を付与し、再試行秒数は動的カウントダウン表示。

## How to run / demo
- `cd typescript && npm run test -- src/entities/auth/api/ws-ticket.test.ts src/app/providers/ws-auth-bridge.test.tsx`
- `cd typescript && npm run typecheck`
- `make validate`

## Known issues / follow-ups
- レビューゲート結果:
- `reviewer_ui_guard`: `run_ui_checks: true`
- `reviewer`: blocking finding なし
- `reviewer_ui`: blocking finding なし
