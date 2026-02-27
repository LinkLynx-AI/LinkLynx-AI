# LIN-590 Implement Rules

- Keep scope strictly documentation-only.
- Do not change runtime code, DB schema, or infra definitions.
- Keep policy values fixed to secure short TTL profile:
  - upload signed URL TTL = 5 minutes
  - download signed URL TTL = 5 minutes
  - accidental deletion protection window = 7 days
- Keep class/outage decisions aligned with ADR-002 SSOT.
- Keep schema compatibility note explicit: ADR-001 is N/A for this issue because no event schema change is included.
- Keep contracts and runbook mutually referential to avoid drift.
