# LIN-624 Plan

## Milestones
1. Extend verified token claims with `email_verified` and enforce check in shared `AuthService`.
2. Add new auth error kind/app code mapping: `AUTH_EMAIL_NOT_VERIFIED`.
3. Add audit log field for email verification decision in REST/WS auth logs.
4. Update tests for verified/unverified behavior and mapping contract.
5. Sync operations runbook with the new failure class and required log field.

## Validation commands
- make rust-lint
- make validate

## Acceptance checks
- Functional: unverified token is denied consistently in REST and WS.
- Compatibility: verified + mapped principal still succeeds.
- Contract: new app code maps to HTTP 403 and WS 1008 without breaking existing 401/403/503 semantics.
- Observability: auth logs include an email verification decision field.
