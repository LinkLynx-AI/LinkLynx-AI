# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: validation が失敗したら次へ進む前に修正する。

## Milestones
### M1: Auth smoke script を追加
- Acceptance criteria:
  - [ ] Firebase login -> protected ping -> ws identify の正常系を検証できる。
  - [ ] `dependency-unavailable` モードで `503 / 1011` を検証できる。
- Validation:
  - `cd typescript && npm run typecheck`
  - `cd typescript && npm run test -- scripts/auth-e2e-smoke.test.mjs`

### M2: env / runbook / issue evidence を更新
- Acceptance criteria:
  - [ ] `.env.example` に smoke 用資格情報の説明が追加される。
  - [ ] auth / authz runbook にローカル再現と切り分けが追記される。
  - [ ] `docs/agent_runs/LIN-645/Documentation.md` に検証結果を記録する。
- Validation:
  - `make validate`
  - `make rust-lint`
  - `cd typescript && npm run typecheck`
