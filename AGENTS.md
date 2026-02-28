## Working agreements (linklinx-AI)
- Child issues should follow the rule: 1 issue = 1 PR.
- Auto-merge into `main` is prohibited. PRs targeting `main` require human approval.
- PRs targeting designated branches other than `main` may be auto-merged when tests pass and review is approved.
- Do not mix out-of-scope improvements (separate refactors into different issues).
- PR title and description must be written in Japanese.

## Quality commands
- Primary (all languages): `make validate`
- Rust strict gate: `make rust-lint`
- TypeScript typecheck: `cd typescript && npm run typecheck`

## Agent memory (required)
- For long-running or continuous tasks, create and maintain Prompt.md / Plan.md / Implement.md / Documentation.md.

## Documentation reference (required)
- Before planning or implementation, check relevant documents under `docs/` and align the work with documented rules/contracts.
- For backend Rust changes, read `docs/RUST.md` first.
- For frontend TypeScript changes, read `docs/TYPESCRIPT.md` first.
- For Python service changes, read `docs/PYTHON.md` first.
- For database/schema/runtime contract changes, read `docs/DATABASE.md` and related files under `database/contracts/`.
- For ADR-governed changes (event schema compatibility, delivery class boundary, search consistency, AuthZ fail-close, Dragonfly rate-limit failure policy), read relevant files under `docs/adr/` before implementation. Use `docs/adr/README.md` to identify the target ADR.
- For runbook-governed operational changes (for example search reindex, edge REST/WS routing/drain, session/resume continuity, and Postgres PITR operations), read relevant files under `docs/runbooks/` before implementation. Use `docs/runbooks/README.md` to identify the target runbook.
- For Dragonfly/Redis rate-limit outage policy, degraded transition thresholds, recovery resynchronization rules, and Postgres migration/pooling contracts, also read related runtime contract files under `database/contracts/` before implementation.
- Event schema changes must be additive and backward-compatible only. Breaking changes are prohibited unless approved via a separate ADR.
- Event Class A/B classification and outage behavior decisions must follow ADR-002 as the single source of truth.
- AuthZ decisions must follow ADR-004 fail-close baseline (no fail-open, no stale-if-error) unless explicitly superseded by a newer approved ADR.
- Dragonfly outage behavior for rate limiting must follow ADR-005 hybrid baseline (high-risk fail-close, continuity paths degraded fail-open) unless explicitly superseded by a newer approved ADR.
- Postgres migration/pooling/PITR operation decisions must follow the LIN-588 baseline contract and runbook unless explicitly superseded by a newer approved ADR/contract.
- PR description must include the ADR-001 checklist result and the compatibility decision rationale when event contracts are in scope.

## Docs map (summary)
- `docs/`
  - `docs/DATABASE.md`: Current database state summary, source-of-truth files, and DB operation/update rules.
  - `docs/RUST.md`: Rust implementation rules (layer boundaries, module structure, typing/error handling, testing, lint/format).
  - `docs/TYPESCRIPT.md`: TypeScript/FSD rules (dependency direction, boundaries, typing, React usage, testing, lint/format).
  - `docs/PYTHON.md`: Python/FastAPI rules (typing, naming, exception handling, function docs, lint/format/test).
  - `docs/adr/`: ADR directory summary and per-file descriptions are documented in `docs/adr/README.md`.
  - `docs/runbooks/`: Runbook directory summary and per-file descriptions are documented in `docs/runbooks/README.md`.
    - `docs/runbooks/session-resume-dragonfly-operations-runbook.md`: Session/resume/TTL baseline, Dragonfly outage degraded behavior, and TTL rollout/rollback procedure.
