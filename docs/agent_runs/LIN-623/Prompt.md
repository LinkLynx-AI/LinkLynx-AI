# LIN-623 Prompt

## Goal
- Fix v1 password reset responsibility to Firebase delegation only.
- Keep backend runtime free from local reset/password update execution paths.
- Reflect failure handling and responsibility boundary in auth operations runbook.

## Non-goals
- Implementing custom SMTP or third-party mail provider integration.
- Adding a new backend password-reset API.
- AuthZ changes or unrelated auth refactors.

## Done conditions
- Backend contract explicitly does not provide local password reset runtime path.
- Firebase delegation policy and failure handling are documented in runbook.
- Tests guard against accidental reintroduction of legacy local reset endpoints.
