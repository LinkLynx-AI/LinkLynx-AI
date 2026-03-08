# LIN-894 Plan

## Rules
- Stop-and-fix: validation が落ちたら次の工程へ進む前に修正する。

## Milestones
### M1: ギャップ特定と run 証跡の整備
- Acceptance criteria:
  - [ ] moderation 実装の現状差分が整理されている
  - [ ] `docs/agent_runs/LIN-894/` の run 台帳が揃っている
- Validation:
  - `git status --short`
  - `rg -n "moderation|guild:moderate" rust/apps/api/src typescript/src docs`

### M2: moderation 導線の不足差分を実装
- Acceptance criteria:
  - [ ] backend / frontend の受け入れ基準ギャップが解消されている
  - [ ] `/guilds/{guild_id}/moderation/*` の authz resource / action が `guild:moderate` contract と矛盾しない
  - [ ] service 側の moderator 判定が authorizer の `Guild + Manage` と整合している
  - [ ] out-of-scope 変更を含めていない
- Validation:
  - `cargo test -p linklynx_backend moderation -- --nocapture`
  - `cd typescript && npm run typecheck`
  - `pnpm --dir typescript test -- moderation`

### M3: 総合検証と PR 証跡の確定
- Acceptance criteria:
  - [ ] `make validate` が通る
  - [ ] review gate 結果が記録されている
  - [ ] runtime smoke の結果または skip 理由が記録されている
- Validation:
  - `make validate`
  - reviewer stack
