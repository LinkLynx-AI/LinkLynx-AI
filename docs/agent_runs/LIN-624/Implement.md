# LIN-624 Implement Rules

- Keep scope limited to auth verification + error mapping + tests + runbook sync.
- Implement the verification gate only in shared auth path (`AuthService`) to avoid REST/WS drift.
- Treat `email_verified != true` (including missing claim) as `AUTH_EMAIL_NOT_VERIFIED`.
- Preserve existing fail-close behavior and existing token/principal error mapping.
- Do not add endpoint-specific exception branches.
