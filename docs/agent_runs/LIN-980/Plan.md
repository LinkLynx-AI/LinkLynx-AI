# Plan

## Rules
- Stop-and-fix: validation / review 失敗時は次工程へ進まない。
- Scope lock: permission-snapshot の境界監査と文書更新に限定する。
- Start mode: child issue start (`LIN-980` under `LIN-976`)。

## Milestones
### M1: permission-snapshot 監査ログを追加する
- Acceptance criteria:
  - [ ] handler success / validation / unavailable で監査ログ項目が揃う
  - [ ] principal_id / guild_id / channel_id の helper を test で固定する
- Validation:
  - `cd rust && cargo test -p linklynx_backend permission_snapshot -- --nocapture`

### M2: mixed v1/non-v1 境界と cutover 条件を文書へ反映する
- Acceptance criteria:
  - [ ] current non-`v1` path の理由が明記される
  - [ ] cutover 条件が追跡可能になる
- Validation:
  - doc diff review

### M3: 全体検証と review gate を通す
- Acceptance criteria:
  - [ ] `make rust-lint` が通る
  - [ ] `make validate` が通る
  - [ ] reviewer gate の結果を記録する
- Validation:
  - `make rust-lint`
  - `make validate`
