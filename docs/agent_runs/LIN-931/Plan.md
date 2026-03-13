# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: if validation fails, repair it before moving to the next step.

## Milestones
### M1: WS handshake auth failure mapping を修正する
- Acceptance criteria:
  - [ ] Authorization header 失敗が HTTP auth error ではなく WS close へ写像される
  - [ ] dependency unavailable は `1011`、その他は `1008`
- Validation:
  - `cargo test ws_handshake --manifest-path rust/Cargo.toml`

### M2: 回帰テストと run record を更新する
- Acceptance criteria:
  - [ ] invalid / unavailable / success の代表経路が test 化される
  - [ ] `Documentation.md` に決定と検証結果が残る
- Validation:
  - `cargo test ws_handshake --manifest-path rust/Cargo.toml`
