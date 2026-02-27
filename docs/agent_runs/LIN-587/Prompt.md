# LIN-587 Prompt

## Goal
- Fix the v0 session/resume contract for Dragonfly-backed gateway continuity.
- Keep this issue documentation-only and avoid runtime code changes.

## Non-goals
- Implement full gateway resume runtime behavior in Rust.
- Introduce Dragonfly as a persistent source of record.
- Design v1 advanced session distribution.

## Done conditions
- Session state model (`active` / `resumable` / `expired`) is documented.
- Dragonfly key/TTL contract is fixed with `session TTL = 180s`.
- Resume success/failure conditions and fallback behavior are documented.
- Dragonfly outage degraded behavior is aligned with ADR-005.
- TTL rollout and rollback procedure is documented in runbook form.
