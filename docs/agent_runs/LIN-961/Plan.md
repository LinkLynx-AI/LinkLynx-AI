# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: if validation fails, repair it before moving to the next step.

## Milestones
### M1: 現行 docs の edge 前提を棚卸しする
- Acceptance criteria:
  - [ ] Cloudflare 前提の記述箇所を特定している。
  - [ ] LIN-961 acceptance criteria と user decision を照合している。
- Validation:
  - `rg -n "Cloudflare|Cloud DNS|Certificate Manager|Cloud Armor|Cloud CDN|API Gateway" docs -S`

### M2: ADR と infra summary を更新する
- Acceptance criteria:
  - [ ] ADR-006 を追加して GCP native edge baseline を文書化している。
  - [ ] `docs/infra/01_decisions.md` の edge decision が ADR と一致している。
- Validation:
  - `make validate`

### M3: Runbook を新 baseline に合わせる
- Acceptance criteria:
  - [ ] edge REST/WS runbook の routing path と責務分界が GCP native edge に更新されている。
  - [ ] rollback / observability の記述が新 baseline に沿っている。
- Validation:
  - `make validate`
  - `git diff --check`
