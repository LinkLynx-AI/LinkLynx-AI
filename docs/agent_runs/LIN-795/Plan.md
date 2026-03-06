# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: if validation fails, repair it before moving to the next step.

## Milestones
### M1: LIN-805 ポリシー基盤の実装
- Acceptance criteria:
  - [ ] operation class と action mapping が Rust コードに入る
  - [ ] degraded enter/exit threshold がコード上で表現される
  - [ ] internal metrics snapshot で threshold と状態を観測できる
- Validation:
  - `cd rust && cargo test -p linklynx_backend ratelimit`

### M2: LIN-809 REST rate limit 適用
- Acceptance criteria:
  - [ ] 投稿/招待/モデレーション経路へ rate limit が適用される
  - [ ] 超過時 `429 + Retry-After` を返す
  - [ ] degraded 時に高リスク fail-close / message create fail-open が分岐する
- Validation:
  - `cd rust && cargo test -p linklynx_backend main::tests`

### M3: LIN-815 監視/文書/障害試験整備
- Acceptance criteria:
  - [ ] runbook を追加し監視条件と障害模擬手順を記載する
  - [ ] rate-limit internal metrics / observation が runbook 手順を支える
  - [ ] runtime contract 参照文書が更新される
- Validation:
  - `cd rust && cargo test -p linklynx_backend ratelimit`
  - `make validate`
  - `make rust-lint`

### M4: 横断検証
- Acceptance criteria:
  - [ ] `make validate` が成功
  - [ ] `make rust-lint` が成功
  - [ ] reviewer gate を通過する
- Validation:
  - `make validate`
  - `make rust-lint`
  - `spawn_agent(reviewer)`
