# LIN-586 Implement Rules

- Keep scope limited to LIN-586 and its child issues.
- Prefer additive changes; avoid refactors outside auth path.
- Keep REST and WS auth behavior consistent via shared service.
- Keep /health endpoint behavior unchanged.
- Use fail-close defaults on auth dependency uncertainty.
- Keep WS reauth boundary strict: no application payload processing while reauth is pending.
