# Plan

## Rules
- Stop-and-fix: validation / review 失敗時は先へ進まない。
- Scope lock: internal auth/authz endpoint guard、回帰テスト、関連 docs のみに限定する。
- Start mode: child issue start (`LIN-984` under `LIN-976`)。

## Milestones
### M1: dedicated internal guard を実装する
- Acceptance criteria:
  - [ ] `/internal/auth/metrics`、`/internal/authz/metrics`、`/internal/authz/cache/invalidate` が `rest_auth_middleware` とは別の internal guard を通る
  - [ ] internal shared secret 未設定時は fail-close する
- Validation:
  - targeted Rust tests

### M2: internal endpoint 回帰テストと docs を更新する
- Acceptance criteria:
  - [ ] bearer token only reject と internal secret allow の両方をテストで固定する
  - [ ] `docs/AUTHZ_API_MATRIX.md` などの境界文書が current implementation と一致する
- Validation:
  - targeted Rust tests
  - doc diff review

### M3: 最終確認と PR evidence を残す
- Acceptance criteria:
  - [ ] `make validate`
  - [ ] `make rust-lint`
  - [ ] `cd typescript && npm run typecheck`
  - [ ] evidence が `Documentation.md` に残る
- Validation:
  - validation commands
