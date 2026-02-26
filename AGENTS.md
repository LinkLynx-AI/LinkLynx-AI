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
- For event delivery class/boundary/outage changes, read `docs/adr/ADR-002-class-ab-event-classification-and-delivery-boundary.md` before implementation.
- Event schema changes must be additive and backward-compatible only. Breaking changes are prohibited unless approved via a separate ADR.
- Event Class A/B classification and outage behavior decisions must follow ADR-002 as the single source of truth.
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
