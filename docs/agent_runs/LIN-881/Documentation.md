# Documentation.md (Status / audit log)

## Current status
- Now: PR is open and `LIN-881` is `In Review`.
- Next: Human review on PR #1062.

## Decisions
- `LIN-881` was reopened and moved back to `In Progress`.
- WS text ready-state messages now use the same `/ws/stream` AuthZ boundary as binary stream messages.
- `/internal/authz/metrics` is protected by the existing REST auth/authz middleware by moving the route into `protected_routes`.
- WebSocket regression tests use a local test server and therefore require validation outside the sandbox.

## How to run / demo
- `make rust-lint`
- `make validate`
- `cargo test -p linklynx_backend ws_`
- `cargo test -p linklynx_backend internal_authz_metrics_`

## Known issues / follow-ups
- Implemented changes:
  - `rust/apps/api/src/main/ws_routes.rs`
    - Non-protocol text frames in `handle_ready_message` now call `authorize_ws_stream_operation` before echoing.
  - `rust/apps/api/src/main/http_routes.rs`
    - `/internal/authz/metrics` moved from the public router to `protected_routes`.
  - `rust/apps/api/src/main/tests.rs`
    - Added `internal_authz_metrics_...` tests for missing token, valid token, and authz denied.
    - Added `internal_authz_metrics_endpoint_returns_unavailable_when_authz_unavailable`.
    - Added WS text regression tests for allow, denied (`1008/AUTHZ_DENIED`), and unavailable (`1011/AUTHZ_UNAVAILABLE`).
  - `rust/apps/api/Cargo.toml` / `rust/Cargo.lock`
    - Added test-only WebSocket helpers (`tokio-tungstenite`, `futures-util`).
- Validation results:
  - `cargo test -p linklynx_backend ws_` passed outside sandbox: 13 passed, 0 failed.
  - `cargo test -p linklynx_backend internal_authz_metrics_` passed outside sandbox: 4 passed, 0 failed.
  - `make rust-lint` passed outside sandbox after the final unavailable-path test was added.
  - `make validate` passed outside sandbox after preparing `python/.venv` and installing `typescript` dependencies.
- Review gate:
  - `reviewer_ui_guard`: `false` (no UI review required).
  - `reviewer`: pass, no blocking findings.
  - Follow-up addressed: added unavailable-path regression for `/internal/authz/metrics`.
- Delivery result:
  - Branch: `codex/lin-881-authz-bypass-fix`
  - PR: `https://github.com/LinkLynx-AI/LinkLynx-AI/pull/1062`
  - Base branch: `main`
  - Merge policy: `main` 向けのため auto-merge は使わず human approval 待ち
