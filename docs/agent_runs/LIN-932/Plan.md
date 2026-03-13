# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: if validation fails, repair it before moving to the next step.

## Milestones
### M1: 対象の未接続 persistence / repository を特定して接続する
- Acceptance criteria:
  - [ ] scope に合う runtime / repository の未接続が埋まる
- Validation:
  - `cargo test message --manifest-path rust/Cargo.toml`

### M2: protocol snapshot / acceptance tests を追加する
- Acceptance criteria:
  - [ ] additive-only regression を検知できる
  - [ ] 最小 acceptance path が test で固定される
- Validation:
  - `cargo test protocol --manifest-path rust/Cargo.toml`

### M3: run record を更新する
- Acceptance criteria:
  - [ ] `Documentation.md` に決定と検証結果が残る
- Validation:
  - `make rust-lint`
