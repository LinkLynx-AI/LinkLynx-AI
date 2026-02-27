# LIN-586 Documentation Log

## Status
- Completed implementation pass for LIN-586 scoped child issues (614/615/616/617/619/618) in a unified branch.
- Added schema + runtime auth flow + operations runbook updates.
- Applied follow-up hardening for reviewer P1s: JWKS refresh throttling/backoff, WS reauth boundary strictness, fail-close runtime store defaults, stale-cache cleanup, structured auth decision logs, startup panic removal, and lightweight Postgres client pool.
- Applied review follow-up for LIN-586 PR: configurable `iat` skew, principal store exponential backoff retries, env parse warning logs, metrics helper extraction, and Postgres transport security fail-close default with explicit local opt-out.

## Decisions
- REST error mapping: 401/403/503.
- WS token expiry behavior: in-band reauth request with deadline and fail-close close-code mapping.
- Dependency failure behavior: fail-close (`503` for REST, `1011` for WS).
- Runtime principal store default: `DATABASE_URL` missing => fail-close; in-memory seed fallback is explicit opt-in (`AUTH_ALLOW_IN_MEMORY_PRINCIPAL_STORE=true`).
- Postgres principal store transport policy: TLS is required by default (fail-close) and plaintext is allowed only when `AUTH_ALLOW_POSTGRES_NOTLS=true` is explicitly set for local/development.
- JWKS missing-`kid` handling: per-`kid` + global backoff with unavailable-class preservation during dependency outage windows.

## Implemented artifacts
- DB migration: `0005_lin614_auth_identities` (up/down)
- Runtime auth module: Firebase token verification + JWKS cache + uid->principal resolver
- REST middleware: shared auth, context injection (`principal_id`, `request_id`)
- WS flow: handshake auth + in-band reauth + close policy
- Ops docs: Firebase/principal operations runbook

## Validation results
- `cargo test -p linklynx_backend --locked --offline`: passed (22/22)
- `make rust-lint`: passed (`fmt`/`clippy`/`cargo test --workspace`)
- `make validate` (under `rust/`): passed (`coverage-check` included, line coverage `53.33%` with threshold `45%`)

## Pending
- Reviewer still flags one potential product decision:
  - WS auth handshake currently requires `Authorization` header only (browser-native WS auth transport compatibility is intentionally not added in this scope).
