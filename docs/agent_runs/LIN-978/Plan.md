# Plan

## Rules
- Stop-and-fix: validation / review 失敗時は次工程へ進まない。
- Scope lock: LIN-978 は v1 moderation PATCH の実処理接続に限定する。
- Start mode: child issue start (`LIN-978` under `LIN-976`)。

## Milestones
### M1: PATCH handler を moderation service に接続する
- Acceptance criteria:
  - [ ] v1 PATCH がスタブではなく `create_mute` を呼ぶ
  - [ ] request body から reason / expires_at を受け取る
  - [ ] structured log に principal_id / guild_id / member_id / action が残る
- Validation:
  - `cd rust && cargo test -p linklynx_backend moderation -- --nocapture`

### M2: target member not found / dependency unavailable を固定する
- Acceptance criteria:
  - [ ] 対象 member 未存在で `404`
  - [ ] service unavailable で `503`
  - [ ] role-based allow / deny の既存回帰が維持される
- Validation:
  - `cd rust && cargo test -p linklynx_backend moderation -- --nocapture`

### M3: 全体検証と review gate を通す
- Acceptance criteria:
  - [ ] `make rust-lint` が通る
  - [ ] review gate の blocking finding がない
  - [ ] 検証結果を `Documentation.md` に記録する
- Validation:
  - `make rust-lint`
