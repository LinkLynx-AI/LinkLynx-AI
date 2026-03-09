# LIN-894 Plan

## Rules
- Stop-and-fix: validation が落ちたら次の工程へ進む前に修正する。

## Milestones
### M1: parent-child run 証跡の整備
- Acceptance criteria:
  - [ ] `LIN-927` / `LIN-928` / `LIN-929` の順序と状態が整理されている
  - [ ] `docs/agent_runs/LIN-894/` の run 台帳が parent issue 前提に揃っている
- Validation:
  - `git status --short`
  - `rg -n "LIN-927|LIN-928|LIN-929|leaf issue|parent issue" docs/agent_runs/LIN-894`

### M2: child issue 進捗の反映
- Acceptance criteria:
  - [ ] `LIN-927` 完了済み、`LIN-928` 実装中、`LIN-929` 未着手の状態が記録されている
  - [ ] 親ブランチに入っている moderation 差分がどの child issue の受け入れ条件に対応するか追跡できる
  - [ ] out-of-scope 変更を含めていない
- Validation:
  - `cargo test -p linklynx_backend moderation -- --nocapture`
  - `cd typescript && npm run typecheck`
  - `pnpm --dir typescript test -- --run moderation`

### M3: 総合検証と PR 証跡の確定
- Acceptance criteria:
  - [ ] `make validate` が通る
  - [ ] review gate 結果が記録されている
  - [ ] child PR / 親ブランチの証跡が記録されている
  - [ ] runtime smoke の結果または skip 理由が記録されている
- Validation:
  - `make validate`
  - reviewer stack
