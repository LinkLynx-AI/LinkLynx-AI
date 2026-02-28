# LIN-620 Implement Rules

- Keep auth decision path shared between REST and WS.
- Keep provisioning logic inside dedicated principal boundary, not middleware.
- Preserve fail-close on dependency unavailability.
- Avoid unrelated refactors.
- Update only docs/contracts that become inconsistent due to this scope.
