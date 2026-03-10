# Documentation.md (Status / audit log)

## Current status
- Now: `LIN-909` の avatar / banner 保存反映実装と targeted TypeScript validation は完了。残りは review 結果の確認と環境ブロックの整理。
- Next: reviewer gate を確認し、必要なら最終修正を入れる。

## Decisions
- start mode は standalone smallest-unit issue start として current branch `codex/lin-909` を使う。
- `LIN-909` を成立させるため、`users.banner_key` と profile API の `banner_key` を additive に追加した。
- `LIN-909` では既存 storage 連携を使って avatar / banner の object key を保存し、save 失敗時は best-effort cleanup を行う。
- session 由来の fallback user は維持しつつ、`useMyProfile` 成功時に `auth-store` を上書き同期する。
- `avatar_key` は API/query 契約として保持し、`auth-store` へは Storage download URL を解決してから反映する。

## How to run / demo
- 実行済み:
  - `cd typescript && npm install`
  - `cd typescript && npm run test -- src/shared/api/mutations/use-my-profile.test.ts src/app/providers/auth-bridge.test.tsx src/features/settings/ui/user/user-profile.test.tsx src/shared/api/guild-channel-api-client.test.ts`
  - `cd typescript && npm run typecheck`
  - `cd rust && cargo test -p linklynx_backend profile` は `linker 'cc' not found` により未実行
  - `make validate` は Python 環境で `/usr/bin/python3: No module named pip` により停止

## Review notes
- targeted frontend tests は 38 件 pass。
- `UserProfile` test 実行時に React `act(...)` warning は出るが、失敗ではなく既存 effect/hydration パターン由来の警告として残っている。
- Rust test failure は今回の差分ではなくローカル build toolchain に C linker (`cc`) が存在しないことに起因する。
- `make validate` failure は今回の TypeScript diff ではなく Python dev tools 未整備 (`pip` / `ensurepip` 不在) に起因する。

## Known issues / follow-ups
- `make validate` と Rust test を CI/開発機で再実行するには `pip` と `cc` を含む build toolchain が必要。
