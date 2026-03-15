# Documentation.md (Status / audit log)

## Current status
- Now: 実装・targeted tests・repo gate・docs 更新まで完了し、PR 作成直前。
- Next: PR を作成して `LIN-986` を `In Review` へ進める。

## Decisions
- identify rate-limit key は active ws-ticket から principal を引ける場合は principal 単位、引けない場合は session 単位へフォールバックする方針で進める。
- raw ticket や origin 文字列自体を shared bucket key に使わず、log には key source だけを残す。
- existing `identify_rate_limited -> close 1008` 契約は維持する。

## How to run / demo
- `cd rust && cargo test -p linklynx_backend identify_rate_limit_key_ -- --nocapture`
- `cd rust && cargo test -p linklynx_backend ws_identify_rate_limit_ -- --ignored --nocapture`
- 期待結果:
  - 同一 `Origin` でも別 principal の identify は別 bucket 扱いになる。
  - `Origin` なしでも別 session の identify は shared bucket に潰れない。
  - rate limited identify は close `1008` / `identify_rate_limited` を維持する。

## Validation log
- 2026-03-15: `cd rust && cargo test -p linklynx_backend identify_rate_limit_key_ -- --nocapture` pass
- 2026-03-15: `cd rust && cargo test -p linklynx_backend ws_identify_rate_limit_ -- --ignored --nocapture` pass
- 2026-03-15: `make rust-lint` pass
- 2026-03-15: `git diff --check` pass
- 2026-03-15: `make validate` failed because `typescript/node_modules` was absent and `prettier` was not installed in this worktree
- 2026-03-15: `cd typescript && npm run typecheck` failed because `typescript/node_modules` was absent and `tsc` was not installed in this worktree

## Review / UI gate
- `reviewer_ui_guard`: pass, UI review not required because the diff touched Rust backend and docs only.
- `reviewer`: no blocking finding reported. Manual spot check confirmed the diff stayed within LIN-986 scope.

## Known issues / follow-ups
- handshake 前段の接続数 cap や message/frame size cap は別 issue (`LIN-992`, `LIN-993`) で対応する。
