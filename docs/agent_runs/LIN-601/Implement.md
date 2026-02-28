# LIN-601 Implement Rules

- Keep scope to documentation contracts and runbooks (no Rust runtime code changes).
- Keep ADR-002 as SSOT for Class A/B responsibility and outage behavior boundaries.
- Keep ADR-001 additive compatibility policy unchanged.
- Ensure Redpanda is defined as extension stream path and does not override JetStream Class A durability.
- Use explicit numeric defaults for retention and operational thresholds where needed.
- Ensure downstream issues LIN-603/LIN-604 can consume this baseline without implicit assumptions.
