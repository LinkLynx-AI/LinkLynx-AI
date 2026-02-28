# LIN-587 Documentation Log

## Status
- Initialized LIN-587 run memory files.
- Completed documentation pass for LIN-587 scoped artifacts (runtime contract + runbook + index updates).

## Decisions
- Scope: documentation-only (no runtime code change).
- Session TTL baseline: `180s`.
- Heartbeat/liveness baseline: `30s` / `90s` (from edge WS runbook).
- Outage posture: ADR-005 aligned degraded fail-open for read/session continuity paths.

## Implemented artifacts
- `docs/agent_runs/LIN-587/Prompt.md`
- `docs/agent_runs/LIN-587/Plan.md`
- `docs/agent_runs/LIN-587/Implement.md`
- `docs/agent_runs/LIN-587/Documentation.md`
- `database/contracts/lin587_session_resume_runtime_contract.md`
- `database/contracts/lin139_runtime_contracts.md` (LIN-587 reference section)
- `docs/runbooks/session-resume-dragonfly-operations-runbook.md`
- `docs/runbooks/README.md` (runbook index update)
- `docs/DATABASE.md` (LIN-587 baseline reference)
- `AGENTS.md` (runbook-governed changes guidance update)

## Validation results
- `make validate`: failed due to missing TypeScript formatting dependency.
  - failing step: `cd typescript && make format`
  - root cause: `pnpm run format` -> `prettier: command not found`
  - note: failure is environment dependency related (`node_modules` missing), not caused by LIN-587 document changes.

## Pending
- None in current LIN-587 documentation scope.

## PR notes (acceptance mapping)

| LIN-587 acceptance criterion | Coverage |
| --- | --- |
| 機能: session/resume/TTL/heartbeat仕様が文書化される | `database/contracts/lin587_session_resume_runtime_contract.md` sections 1-4 |
| 性能: resume成功率の目標と計測観点が定義される | `database/contracts/lin587_session_resume_runtime_contract.md` section 6, `docs/runbooks/session-resume-dragonfly-operations-runbook.md` sections 2/6 |
| 障害時: Dragonfly障害時の劣化挙動（presence/session低下）が定義される | `database/contracts/lin587_session_resume_runtime_contract.md` section 5, `docs/runbooks/session-resume-dragonfly-operations-runbook.md` section 5 |
| 運用: TTL変更時のロールアウト手順が記載される | `docs/runbooks/session-resume-dragonfly-operations-runbook.md` section 7 |
