# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: if validation or review fails, fix it before moving to PR creation.

## Milestones
### M1: Reconfirm issue scope and current gaps
- Acceptance criteria:
  - [x] `LIN-881`, `docs/RUST.md`, and `docs/adr/ADR-004-authz-fail-close-and-cache-strategy.md` are reviewed.
  - [x] Relevant code and test entrypoints are identified.
- Validation:
  - `rg -n "internal/authz/metrics|handle_ready_message|authorize_ws_stream_operation" rust/apps/api/src/main -g '!target'`

### M2: Implement scoped fixes
- Acceptance criteria:
  - [x] WS text ready-state messages call the same AuthZ gate as stream operations.
  - [x] `/internal/authz/metrics` is routed behind `rest_auth_middleware`.
  - [x] Regression tests are added for WS text deny/unavailable/allow and internal authz metrics protection.
- Validation:
  - `cargo test -p linklynx_backend ws_`
  - `cargo test -p linklynx_backend internal_authz_metrics_`

### M3: Validate and prepare delivery
- Acceptance criteria:
  - [x] `make rust-lint` passes.
  - [x] `make validate` passes.
  - [x] Reviewer gate is completed.
  - [x] PR is created in Japanese with validation evidence.
- Validation:
  - `make rust-lint`
  - `make validate`
