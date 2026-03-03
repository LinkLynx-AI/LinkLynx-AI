# Implement

## Execution policy
- Plan.md の順序で実装する。
- scope 外変更は行わない。
- 各マイルストーンでテストを実行し、失敗時は即修正する。

## Progress log
- 2026-03-04: auth 関連コードを backend/frontend で探索。
- 2026-03-04: reviewer 実行で P1/P2/P3 指摘を取得。
- 2026-03-04: Backend 修正を反映。
  - `rust/apps/api/src/authz/runtime.rs`: デフォルト/unknown/spicedb フォールバックを `noop_unavailable` へ変更し fail-close 化。
  - `rust/apps/api/src/main/http_routes.rs`: `/internal/auth/metrics` を認証ミドルウェア配下へ移動。
  - `rust/apps/api/src/authz/tests.rs` と `rust/apps/api/src/main/tests.rs`: 上記挙動を検証するテストを追加。
- 2026-03-04: Frontend 修正を反映。
  - `typescript/src/app/providers/auth-bridge.tsx` + `typescript/src/shared/model/stores/auth-store.ts`:
    未認証/不整合セッション時の `currentUser` クリアを追加。
  - `typescript/src/entities/auth/api/principal-provisioning.ts`:
    `token-unavailable` を `network-request-failed` へ潰さず維持。
  - `typescript/src/features/auth-flow/model/error-message.ts` と
    `typescript/src/features/route-guard/ui/protected-preview-gate.tsx`:
    `token-unavailable` をセッション失効系として扱うよう調整。
  - `typescript/src/app/providers/auth-bridge.test.tsx` と
    `typescript/src/features/route-guard/ui/protected-preview-gate.browser.test.tsx` を追加。
- 2026-03-04: 検証実行。
  - `cd rust && cargo test -p linklynx_backend` ✅
  - `cd typescript && npm run test -- src/entities/auth/api/principal-provisioning.test.ts src/features/auth-flow/model/error-message.test.ts src/features/route-guard/ui/protected-preview-gate.test.tsx src/features/route-guard/ui/protected-preview-gate.browser.test.tsx src/app/providers/auth-bridge.test.tsx` ✅
  - `make validate` ✅
- 2026-03-04: 再レビュー実行。
  - `reviewer_simple`: gate=pass（P1以上なし）
  - `reviewer`: gate=pass（P1以上なし、P3の追加テスト改善余地のみ）
- 2026-03-04: P3追補後の最終レビュー実行。
  - `reviewer_simple`: gate=pass（findings 0件、blockingなし）
