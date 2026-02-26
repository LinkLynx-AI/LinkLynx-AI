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
- For event schema/contract changes, read `docs/adr/ADR-001-event-schema-compatibility.md` before implementation.
- For search consistency/SLO/reindex contract changes, read `docs/adr/ADR-003-search-consistency-slo-reindex.md` and `docs/runbooks/search-reindex-runbook.md` before implementation.
- For edge routing/drain policy changes (Cloudflare/GCLB/GKE Ingress, REST/WS path, health check, WS drain), read `docs/runbooks/edge-rest-ws-routing-drain-runbook.md` before implementation.
- For event delivery class/boundary/outage changes, read `docs/adr/ADR-002-class-ab-event-classification-and-delivery-boundary.md` before implementation.
- For AuthZ fail-close policy, API/WS authorization error contracts, or authorization cache invalidation changes, read `docs/adr/ADR-004-authz-fail-close-and-cache-strategy.md` before implementation.
- For Dragonfly/Redis rate-limit outage policy changes, degraded transition thresholds, or recovery resynchronization rules, read `docs/adr/ADR-005-dragonfly-ratelimit-failure-policy.md` and `database/contracts/lin139_runtime_contracts.md` before implementation.
- For Postgres migration forward-only policy, pool exhaustion controls, or PITR operation changes, read `database/contracts/lin588_postgres_operations_baseline.md` and `docs/runbooks/postgres-pitr-runbook.md` before implementation.
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
  - `docs/adr/`
    - `docs/adr/ADR-001-event-schema-compatibility.md`: Event schema compatibility ADR (additive-only, deprecation/versioning, checklist, rollback communication).
    - `docs/adr/ADR-002-class-ab-event-classification-and-delivery-boundary.md`: Class A/B event classification, v0/v1 delivery boundary, and outage/recovery responsibility SSOT.
    - `docs/adr/ADR-003-search-consistency-slo-reindex.md`: Search consistency baseline, lag SLO/SLI, reindex trigger and completion criteria.
    - `docs/adr/ADR-004-authz-fail-close-and-cache-strategy.md`: AuthZ fail-close baseline, REST/WS deny vs unavailable mapping, authorization cache TTL/invalidation strategy, and propagation SLO.
    - `docs/adr/ADR-005-dragonfly-ratelimit-failure-policy.md`: Dragonfly outage rate-limit hybrid policy, degraded enter/exit thresholds, and recovery warm-up/resynchronization baseline.
  - `docs/runbooks/`
    - `docs/runbooks/search-reindex-runbook.md`: Search reindex operational flow (pre-check/start/execute/verify/close) for v0 baseline.
    - `docs/runbooks/edge-rest-ws-routing-drain-runbook.md`: Edge REST/WS routing contract, health checks, rolling WS drain policy, and rollback procedure baseline.
    - `docs/runbooks/postgres-pitr-runbook.md`: PostgreSQL PITR start/execute/verify/close procedure and tabletop drill template for v0 baseline.
