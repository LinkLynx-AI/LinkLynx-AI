# LIN-642 Documentation Log

## Current status
- Now: 実装・検証完了
- Next: PR作成とレビュー依頼

## Decisions
- 未認証/401 は `returnTo` 付き `/login` へ誘導し、ログイン後は `returnTo` 優先で復帰する。
- `returnTo` は内部保護ルートのみ許可し、public/auth/外部URLは破棄する。
- 403 は forbidden、503 は service-unavailable として画面分類する。
- `invite` は public 導線として非保護を維持する。
- 実認証ガードは `@tanstack/react-query` で `/protected/ping` 判定を実行し、`useEffect` 内 setState を避ける。

## How to run / demo
- `cd typescript && npm run dev`
- 未認証で `/channels/me` へアクセスして `/login?returnTo=...` 誘導を確認
- 認証済みで `/channels/me` を開き、正常表示（ping 200）を確認
- `?guard=service-unavailable` で分類画面表示を確認

## Validation results
- `cd typescript && npm run test -- src/entities/auth/api/authenticated-fetch.test.ts src/entities/auth/api/principal-provisioning.test.ts src/features/route-guard/ui/protected-preview-gate.test.tsx src/features/route-guard/ui/route-guard-screen.test.tsx src/shared/config/routes.test.ts src/features/auth-flow/model/route-builder.test.ts`: passed
- `cd typescript && npm run lint`: passed
- `cd typescript && npm run typecheck`: passed
- `cd typescript && npm run test`: passed (14 files, 62 tests)
- `make validate`: passed

## Per-issue evidence (LIN-642)
- issue: `LIN-642`
- branch: `codex/642`
- start mode: child issue start
- review gate: 未実施（PR作成後に `reviewer` / `reviewer_ui_guard` / `reviewer_ui` を実行予定）

## Known issues / follow-ups
- reviewer系サブエージェント可用性は実行時に確認が必要。
