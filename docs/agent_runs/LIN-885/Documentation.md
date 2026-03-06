# Documentation.md (Status / audit log)

## Current status
- Now: LIN-885 implemented, validated, and PR created.
- Next: hand off for human review on `main`.

## Decisions
- 通常導線はモーダルではなく `/settings/profile` route を採用する。
- close / ESC は `returnTo` を使って直前の protected route に戻し、無効時のみ `/channels/me` にフォールバックする。
- 既存 `server-settings` モーダル導線は回帰防止のため維持する。
- settings route shell は `features` ではなく `app/settings/_components` に置き、FSD の layer 逆流を避ける。

## How to run / demo
- 1. チャンネル画面左下ユーザーパネルの歯車をクリックする。
- 2. `/settings/profile` が開くことを確認する。
- 3. `外観` に遷移しても `returnTo` が保持されることを確認する。
- 4. close button または ESC で元の DM / チャンネルへ戻ることを確認する。
- 5. `cd typescript && npm run test -- src/shared/config/routes.test.ts src/widgets/channel-sidebar/ui/user-panel.test.tsx src/app/settings/_components/settings-route-shell.test.tsx`
- 6. `cd typescript && npm run typecheck`
- 7. `make validate`（sandbox では Rust authz tests が `Operation not permitted` で落ち、昇格実行では通過）

## Known issues / follow-ups
- `reviewer_simple` では blocking / high-confidence issue なし。
- `typescript/src/features/settings/ui/user/user-profile.test.tsx` の既存 `act(...)` warning は full test でも継続して出るが、今回差分で悪化はしていない。

## PR / merge policy
- PR: https://github.com/LinkLynx-AI/LinkLynx-AI/pull/1070
- Base branch: `main`
- Policy state: `main` 向けのため auto-merge は設定せず、人手レビュー待ちで停止する。
