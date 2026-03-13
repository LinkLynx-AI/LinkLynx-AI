# Documentation.md (Status / audit log)

## Current status
- Completed: unresolved DM message persistence wiring and protocol compatibility evidence were fixed within `LIN-932` scope.
- Next: no additional code work in `LIN-932`; broader event transport work remains out of scope.

## Decisions
- The concrete persistence gap was the DM message live path: it reused guild-text context lookup, so live runtime could not resolve DM channel metadata correctly.
- Fix scope stayed minimal: add DM channel-context lookup to the message metadata repository, route DM create/list through dedicated usecase entrypoints, and keep the shared `MessageItemV1` contract unchanged.
- Protocol compatibility evidence is repo-local snapshot coverage only; no schema expansion or event rename was introduced.
- Snapshot fixtures were added for `protocol-events` and `protocol-ws` to detect additive-only regressions against the current contract surface.

## How to run / demo
- DM persistence path:
- `cargo test -p linklynx_message_domain dm_ --manifest-path rust/Cargo.toml`
- `cargo test -p linklynx_backend create_dm_message_uses_dm_usecase_path --manifest-path rust/Cargo.toml`
- Protocol snapshot path:
- `cargo test -p linklynx_protocol_events -p linklynx_protocol_ws --manifest-path rust/Cargo.toml`

## Validation
- Passed: `cargo test -p linklynx_message_domain dm_ --manifest-path rust/Cargo.toml`
- Passed: `cargo test -p linklynx_backend create_dm_message_uses_dm_usecase_path --manifest-path rust/Cargo.toml`
- Passed: `cargo test -p linklynx_protocol_events -p linklynx_protocol_ws --manifest-path rust/Cargo.toml`
- Passed: `make rust-lint`
- Passed: `cd typescript && npm run typecheck`
- Blocked: `make validate`
- Reason: Python `py-format` could not install `black==24.10.0` because package resolution/network access for that dependency failed in the local environment.

## Known issues / follow-ups
- Durable event transport/publisher wiring is still intentionally out of scope; this run fixes contract evidence, not event-stream runtime delivery.
- TCP-bind WS fanout smoke remains ignored in this sandbox and is not used as the primary acceptance signal for this issue.
