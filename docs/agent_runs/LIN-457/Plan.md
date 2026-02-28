# LIN-457 Plan

## Milestones
1. LIN-462: CORS allowlist implementation and tests.
2. LIN-464: Input limit middleware (body/timeout) + unified 429/Retry-After contract.
3. LIN-463: AuthContext extension + middleware wiring + tests.
4. Validate and review gates.

## Validation Commands
- `make validate`
- `make rust-lint`

## Acceptance Criteria Mapping
- CORS allowlist and middleware order are explicit in code and tests.
- 401/403/429 contracts are stable and machine-checkable.
- Retry-After exists for 429 responses.
