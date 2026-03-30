# Documentation.md (Status / audit log)

## Current status
- Now:
  - `LIN-974` の実装と validation が完了
  - PR / Linear 更新前の最終整理段階
- Next:
  - branch を commit / push する
  - PR を作成する
  - Linear を `In Review` に更新する

## Decisions
- standard path の incident flow は Discord thread を起点にし、`hirwatan` / `sabe` / `miwasa` mention を維持する。
- `SEV-1` と sustained `SEV-2` では `Incident Commander` / `Comms owner` / `Scribe` を必須 role とする。
- scale trigger は登録者数単独ではなく、WS concurrency、message ingress、latency、DB/search dependency pressure、cost forecast を使う。
- Chaos Engineering は fixed date ではなく、tabletop / rollback / observability readiness が揃ってから開始する。
- standard postmortem は `SEV-1`、`30分超のSEV-2`、rollback / PITR / restore / reindex 実施時に必須化する。

## How to run / demo
- `make validate`
- `git diff --check`
- tabletop demo:
  - SLO breach alert を想定して Discord incident thread を開始
  - IC / comms / scribe を割り当てる
  - dependency-specific runbook に handoff
  - postmortem template を起票する

## Validation log
- `git diff --check`: pass
- `make validate`: pass
  - 既存 TypeScript test で `act(...)` warning などの stderr は出るが、test result は pass

## Files changed
- `docs/runbooks/incident-standard-operations-runbook.md`
- `docs/runbooks/postmortem-standard-template.md`
- `docs/runbooks/README.md`
- `docs/infra/01_decisions.md`
- `infra/README.md`
- `infra/environments/staging/README.md`
- `infra/environments/prod/README.md`
- `docs/agent_runs/LIN-974/Prompt.md`
- `docs/agent_runs/LIN-974/Plan.md`
- `docs/agent_runs/LIN-974/Documentation.md`

## Known issues / follow-ups
- on-call SaaS integration はこの issue の scope 外。
- cost / MAU の実測と alert automation は follow-up で深める。
- reviewer agent gate は未実施。今回は docs-only issue で、ユーザーから sub-agent delegation の明示許可もないため local validation のみで閉じる。
