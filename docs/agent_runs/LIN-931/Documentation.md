# Documentation.md (Status / audit log)

## Current status
- Completed: WS handshake auth failure mapping now stays on the WebSocket upgrade path and fail-closes with WS close-code semantics.
- Next: no additional code work in `LIN-931`; runtime TCP-bind smoke remains optional follow-up outside this sandbox.

## Decisions
- Keep `GET /ws` unauthenticated-upgrade compatibility unchanged.
- Invalid / expired / unavailable auth during header-based WS handshake no longer returns REST-style `401/403/503` bodies.
- Handshake auth failures now upgrade and close via WS semantics so the runtime stays aligned with the auth runbook.
- Bind-free oneshot tests are the primary evidence in this environment; TCP listener tests remain `#[ignore]` because loopback bind is denied here.

## How to run / demo
- Send `GET /ws` with websocket upgrade headers plus `Authorization: Bearer invalid-token`.
- Confirm the route keeps the upgrade path instead of returning an HTTP auth body.
- In a TCP-capable environment, use the ignored WS tests to confirm the close reasons are `AUTH_INVALID_TOKEN` / `AUTH_UNAVAILABLE`.

## Validation
- Passed: `cargo test -p linklynx_backend ws_handshake_invalid_bearer_token_keeps_ws_upgrade_path_in_oneshot --manifest-path rust/Cargo.toml`
- Passed: `cargo test -p linklynx_backend ws_handshake_auth_dependency_unavailable_keeps_ws_upgrade_path_in_oneshot --manifest-path rust/Cargo.toml`
- Passed: `make rust-lint`
- Passed: `cd typescript && npm run typecheck`
- Blocked: `make validate`
- Reason: Python `py-format` could not install `black==24.10.0` because package resolution/network access for that dependency failed in the local environment.

## Known issues / follow-ups
- Ignored TCP-bind WS tests still cannot be executed in this sandbox because `TcpListener::bind("127.0.0.1:0")` is denied.
- This run intentionally does not change session resume or the broader WS protocol surface.
