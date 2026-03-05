# Implement.md (Runbook)

- Follow Plan.md as the single execution order. If order changes are needed, document the reason in Documentation.md and update it.
- Keep diffs small and do not mix in out-of-scope improvements.
- Run validation after each milestone and fix failures immediately before continuing.
- Continuously update Documentation.md with decisions, progress, demo steps, and known issues.

## Execution log

1. Branch baseline sync
- `git merge --no-edit origin/main` を実行し、LIN-804を含む最新 `origin/main` を fast-forward で取り込み。

2. API profile contract integration
- `typescript/src/shared/api/api-client.ts`
  - `MyProfile` / `UpdateMyProfileInput` 型を追加。
  - `getMyProfile` / `updateMyProfile` 契約を追加。
- `typescript/src/shared/api/guild-channel-api-client.ts`
  - `/users/me/profile` GET/PATCH 実装を追加。
  - Zod 境界検証 (`MY_PROFILE_RESPONSE_SCHEMA`) を追加。
  - PATCH の partial payload（変更キーのみ送信）を追加。
- `typescript/src/shared/api/no-data-api-client.ts`
  - no-data fallback 向け `getMyProfile` / `updateMyProfile` を追加。
- `typescript/src/shared/api/mock/mock-api-client.ts`
  - mock 実装へ `getMyProfile` / `updateMyProfile` を追加。

3. Query/Mutation + UI wiring
- `typescript/src/shared/api/queries/use-my-profile.ts` を追加し、`queries/index.ts` へ公開。
- `typescript/src/shared/api/mutations/use-my-profile.ts` を追加し、`mutations/index.ts` へ公開。
- `typescript/src/features/settings/ui/user/user-profile.tsx`
  - `useMyProfile` で初期値同期。
  - `useUpdateMyProfile` で保存処理を実装。
  - 成功表示/エラー表示（再試行）を実装。
  - 更新成功時に `auth-store` の `currentUser.displayName` と `customStatus` を同期。
  - avatar は既存どおり UI プレビューのみ（API更新対象外）を維持。

4. Tests
- `typescript/src/shared/api/guild-channel-api-client.test.ts`
  - `getMyProfile` mapping テストを追加。
  - `updateMyProfile` partial PATCH body テストを追加。
  - 空 payload の `VALIDATION_ERROR` テストを追加。
- `typescript/src/features/settings/ui/user/user-profile.test.tsx`
  - 更新成功時の store 同期テストを追加。
  - 更新失敗時の再試行導線テストを追加。

5. Validation
- 初回失敗:
  - `cd typescript && npm run test -- ...` は `vitest: command not found`。
  - `npm -C typescript ci` は lock 不整合で失敗。
  - `pnpm -C typescript install --frozen-lockfile` は sandbox DNS 制限で失敗。
- 対応:
  - 権限昇格で `pnpm -C typescript install --frozen-lockfile` を再実行し成功。
  - `typescript/tsconfig.tsbuildinfo` は差分が出たため `git show HEAD:... > ...` で復元。
- 成功:
  - `cd typescript && npm run test -- src/shared/api/guild-channel-api-client.test.ts src/features/settings/ui/user/user-profile.test.tsx`
  - `cd typescript && npm run typecheck`
  - `make rust-lint`
  - `make validate`

6. Review feedback fixes (blocker disposition)
- `typescript/src/features/settings/ui/user/user-profile.tsx`
  - `myProfile` の再取得で未保存入力が上書きされないよう、フォーム初期化を「ユーザー切替時 + 初回profile hydration時」に限定。
  - deep import を排除し、`@/shared/api/queries` / `@/shared/api/mutations` の Public API 経由に変更。
- `typescript/src/shared/api/queries/use-my-profile.ts`
  - query key を `["myProfile", userId]` に変更し、アカウントスコープ化。
  - public hook に日本語JSDocを追加。
- `typescript/src/shared/api/mutations/use-my-profile.ts`
  - mutation成功時の cache write key を `["myProfile", userId]` に一致させた。
  - public hook に日本語JSDocを追加。
- `typescript/src/shared/api/my-profile-validation.ts`（新規）
  - update payload 空判定を共通化し、validation error shape を補助するユーティリティを追加。
- `typescript/src/shared/api/no-data-api-client.ts` / `mock/mock-api-client.ts`
  - 空payload更新時に validation error を返すようにして、実APIクライアントとの契約差を解消。
- `typescript/src/shared/api/guild-channel-api-client.test.ts`
  - `statusText` のみ変更時に PATCH body が最小化されるテストを追加。
- `typescript/src/features/settings/ui/user/user-profile.test.tsx`
  - profile再取得で未保存bioが保持される回帰テストを追加。
  - profile取得失敗時の「再試行」導線テストを追加。

7. Final validation rerun after fixes
- `cd typescript && npm run test -- src/shared/api/guild-channel-api-client.test.ts src/features/settings/ui/user/user-profile.test.tsx`
- `cd typescript && npm run typecheck`
- `make rust-lint`
- `make validate`
- `typescript/tsconfig.tsbuildinfo` は生成差分を出さないために `git show HEAD:typescript/tsconfig.tsbuildinfo > typescript/tsconfig.tsbuildinfo` で復元。

8. Review gate rerun
- `reviewer_ui_guard`: `run_ui_checks: true`
- `reviewer`（full stack）: ブロッカーなし（pass相当）。
- UI gate: `cd typescript && pnpm lint` / `pnpm typecheck` / `pnpm test` を実行し、failure なし（pass）。
