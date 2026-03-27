# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: if validation fails, repair it before moving to the next step.

## Milestones
### M1: client-scope source of truth を実装する
- Acceptance criteria:
  - [ ] trusted proxy shared secret + explicit client scope header の組み合わせだけを信頼する
  - [ ] 未設定 / 不正 secret 時は shared anonymous fallback へ戻る
  - [ ] invite verify/join のログに `request_id` / `invite_code` / `client_scope` を残す
- Validation:
  - `cargo test -p linklynx_backend public_invite_endpoint_ -- --nocapture`
  - `cargo test -p linklynx_backend invite_join_ -- --nocapture`

### M2: ドキュメントと回帰テストを固定する
- Acceptance criteria:
  - [ ] trusted scope 分離 / spoof 防止 / degraded fail-close が regression test で固定される
  - [ ] `docs/AUTHZ_API_MATRIX.md` と関連 run memory が source of truth を説明する
- Validation:
  - `make rust-lint`
  - `git diff --check`
  - `make validate`
  - `cd typescript && npm run typecheck`
