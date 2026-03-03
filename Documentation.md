# Documentation

## Current status
- Now: auth 修正・追加テスト・最終レビューまで完了。
- Next: PR作成と最終説明。

## Decisions
- AuthZ runtime の fail-close を優先し、allow-all fallback を除去する。
- 認証状態同期とエラー分類の不整合は frontend 側で明示的に扱う。

## How to run / demo
- Primary validate: `make validate`
- Rust tests: `cd rust && cargo test -p linklynx_backend`
- TS focused tests: `cd typescript && npm run test -- src/entities/auth/api/principal-provisioning.test.ts src/features/route-guard/ui/protected-preview-gate.test.tsx src/features/route-guard/ui/protected-preview-gate.browser.test.tsx src/features/auth-flow/model/error-message.test.ts src/app/providers/auth-bridge.test.tsx`

## Known issues / follow-ups
- 最終レビュー結果: findings 0件 / blocking なし。
