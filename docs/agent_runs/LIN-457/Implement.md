# LIN-457 Implement Rules

- Keep scope to Rust API middleware only.
- Preserve existing auth error shape (`code`, `message`, `request_id`).
- Avoid unrelated refactors.
- Add tests for each contract change.
- Keep default behavior fail-close where policy is ambiguous.
