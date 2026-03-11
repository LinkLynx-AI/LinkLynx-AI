# Documentation.md (Status / audit log)

## Current status
- Now: `LIN-910` の実装差分は投入済み。`AuthBridge` の profile hydration と `useUpdateMyProfile` の cache/store sync を追加し、targeted TypeScript tests と `npm run typecheck` は通過済み。
- Next: repo-wide `make validate` の長時間 Rust test を見届け、PR-ready な検証メモへ整える。

## Decisions
- `LIN-890` 親 issue ではなく `LIN-910` にスコープを限定する。
- `/users/me/profile` は既存契約を source of truth とし、Rust / DB の変更は行わない。
- 主要画面反映は `auth-store` と自分を含む `friends` / `members` query cache までを対象にする。
- avatar / banner 変更は `LIN-909` の責務として触らない。

## How to run / demo
- 認証済み状態で設定画面のプロフィールを開く。
- 表示名または自己紹介を保存し、ユーザーパネルや自分を含む一覧へ即時反映されることを確認する。
- ページ再読込後も値が維持されることを確認する。
- 実行済み validation:
  - `cd typescript && npm run test -- src/app/providers/auth-bridge.test.tsx src/shared/api/mutations/use-my-profile.test.ts src/features/settings/ui/user/user-profile.test.tsx`
  - `cd typescript && npm run typecheck`
  - `make setup` in `python/` to provision local `.venv` for repo validation
  - `reviewer_ui_guard`: UI checks required
  - `reviewer`: blocking findings なし
- 実行中 / 確認待ち:
  - repo root の `make validate` は format, Python format, FSD check, Prettier check, Rust fmt/clippy を通過し、現在 `cargo test --workspace` の長時間ビルド/実行中。
  - `reviewer_ui` は結果未回収。必要なら再実行する。

## Known issues / follow-ups
- avatar / banner の永続化と主要画面反映は `LIN-909` で継続する。
- repo-wide ESLint はこの環境で終端しないため、必要に応じて CI か別環境で full lint gate の完走確認が必要。
- reviewer UI gate は必要に応じて再取得する。
