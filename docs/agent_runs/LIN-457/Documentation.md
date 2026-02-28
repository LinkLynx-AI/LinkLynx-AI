# LIN-457 Documentation Log

## Status
- Implemented LIN-462/LIN-464/LIN-463 scope on branch `codex/lin-457`.
- Validation completed with `make rust-lint` and `make validate` success.

## Decisions
- Child issue execution order: LIN-462 -> LIN-464 -> LIN-463.
- Keep unified HTTP error body shape for new middleware errors.
- Add `Retry-After: 1` for auth dependency-unavailable (`503`) responses.
- Extend `AuthContext` with `expires_at_epoch` for downstream middleware reuse.
- Enforce fail-close input-limit policy for `Transfer-Encoding` and invalid `Content-Length`.
- Validate CORS allowlist entries as origin URLs (`http|https` + authority).
- Reject unbounded request bodies when size hint cannot determine upper bound.
- Normalize allowlist origins to `scheme://authority` to avoid trailing-slash mismatch.
- Make CORS middleware tests deterministic by using fixed allowlist values in test state.

## Validation
- `cd rust && cargo test -p linklynx_backend -- --nocapture` passed.
- `make rust-lint` passed.
- `make validate` passed.
- Sub-agent review feedback reflected and re-validated.

## Follow-ups
- None in this run.

## Added/Used Runtime Config
- `CORS_ALLOW_ORIGINS` (comma-separated origins)
- `HTTP_BODY_LIMIT_BYTES` (default `1048576`)
- `HTTP_REQUEST_TIMEOUT_MILLIS` (default `5000`)
- `HTTP_RETRY_AFTER_SECONDS` (default `1`)
