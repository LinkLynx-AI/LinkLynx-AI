# LIN-624 Documentation Log

## Status
- Implemented.
- Shared auth check, error mapping, tests, and runbook updates are completed.
- Validation finished: `make rust-lint` passed, `make validate` failed due to missing TypeScript toolchain dependencies in local environment.

## Decisions
- `email_verified` missing claim is treated as `false` via serde default.
- Verification gate is enforced immediately after token verification and before principal resolution.
- New deterministic deny contract:
  - app code: `AUTH_EMAIL_NOT_VERIFIED`
  - REST: `403`
  - WS: `1008`
- Auth decision logs include `email_verification` field (`passed`/`failed`/`unknown`).

## Changed artifacts
- `rust/apps/api/src/auth/service.rs`
- `rust/apps/api/src/auth/firebase.rs`
- `rust/apps/api/src/auth/errors.rs`
- `rust/apps/api/src/auth/tests.rs`
- `rust/apps/api/src/main/http_routes.rs`
- `rust/apps/api/src/main/ws_routes.rs`
- `rust/apps/api/src/main/tests.rs`
- `docs/runbooks/auth-firebase-principal-operations-runbook.md`
- `docs/agent_runs/LIN-624/Prompt.md`
- `docs/agent_runs/LIN-624/Plan.md`
- `docs/agent_runs/LIN-624/Implement.md`
- `docs/agent_runs/LIN-624/Documentation.md`

## Validation results
- `make rust-lint`: passed.
- `make validate`: re-run after final fixes; still fails at `typescript` formatter step because `prettier` is not installed (`node_modules` missing).

## Pending
- None for LIN-624 code scope.
