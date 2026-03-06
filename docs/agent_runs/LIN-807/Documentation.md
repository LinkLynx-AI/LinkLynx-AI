# Documentation.md (Status / audit log)

## Current status
- Now: LIN-807 実装 + reviewer指摘反映 + 品質ゲート/レビューゲート完了。
- Next: PR作成。

## Decisions
- LIN-807では display_name / status_text の永続化を対象にする。
- avatar はUIプレビューのみで、API更新対象から外す。
- status_text は設定画面の自己紹介とユーザーパネル customStatus に反映する。
- `myProfile` queryはアカウント切替時の誤再利用を防ぐため userId スコープ key を採用する。
- プロフィール同期は初回hydrationのみとし、未保存フォーム上書きを禁止する。
- no-data/mock でも空payload更新を `VALIDATION_ERROR` として拒否し、実APIと契約を揃える。

## How to run / demo
- 1. `pnpm -C typescript install --frozen-lockfile`
- 2. `cd typescript && npm run test -- src/shared/api/guild-channel-api-client.test.ts src/features/settings/ui/user/user-profile.test.tsx`
- 3. `cd typescript && npm run typecheck`
- 4. `make rust-lint`
- 5. `make validate`
- 6. UIデモ:
  - ユーザー設定 > プロフィールを開く。
  - 表示名/自己紹介を変更して「変更を保存」を押す。
  - 成功メッセージ表示と、左下ユーザーパネル表示（displayName/customStatus）が更新されることを確認する。
  - API失敗時にエラー表示と「再試行」導線が表示されることを確認する。
  - 入力中にプロフィール再取得が起きても、未保存の入力値が維持されることを確認する。

## Known issues / follow-ups
- `user-profile.test.tsx` 実行時に React `act(...)` 警告は出るが、テスト結果自体は pass。
- avatar_key の永続化（画像アップロード経路）は LIN-807 スコープ外。
