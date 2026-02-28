# LIN-587 Implement Rules

- Keep scope limited to LIN-587 documentation contracts and runbooks.
- Do not modify Rust runtime code in this issue.
- Reuse existing baseline values unless LIN-587 explicitly overrides them.
- Keep Dragonfly role as volatile cache/state only, never persistent SoR.
- Keep degraded behavior wording aligned with ADR-005 hybrid policy.
- Ensure downstream issue LIN-593 can consume this contract without additional assumptions.
