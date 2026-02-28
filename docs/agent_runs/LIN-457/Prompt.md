# LIN-457 Prompt

## Goal
- Implement HTTP common middleware baseline for LIN-457 via child issues LIN-462/LIN-464/LIN-463.
- Fix middleware order contract to `CORS -> AuthContext -> InputLimit` for protected HTTP endpoints.

## Non-goals
- No TLS/container runtime hardening changes.
- No WS behavior redesign beyond AuthContext contract alignment.

## Done Conditions
- CORS is allowlist-based (no wildcard allow-all in runtime defaults).
- InputLimit middleware returns unified 429 contract with `Retry-After`.
- AuthContext contains reusable fields for downstream middleware.
- Tests cover CORS allowlist behavior, auth contract, and input-limit responses.
