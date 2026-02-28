# LIN-624 Prompt

## Goal
- Enforce `email_verified` as a required authentication condition for protected REST/WS paths.
- Keep REST and WS decision semantics aligned by implementing the check in the shared auth service.
- Introduce `AUTH_EMAIL_NOT_VERIFIED` with consistent mapping and observable audit logs.

## Non-goals
- UI/email-flow implementation changes.
- Endpoint-specific auth exceptions.
- AuthZ policy changes.

## Done conditions
- Unverified token is rejected consistently in REST and WS protected paths.
- Verified token with valid principal mapping preserves existing allow path.
- Error mapping remains compatible with existing 401/403/503 contract.
- Auth decision logs include email verification decision result.
