# LIN-590 Prompt

## Goal
- Fix one v0 baseline for GCS attachment operations by documenting signed URL policy, object key naming, retention policy, and recovery behavior.
- Keep outputs implementation-ready for LIN-597 DR handover.

## Non-goals
- Runtime API implementation
- DB schema changes
- CDN optimization details
- Terraform or infra rollout changes

## Done conditions
- Signed URL policy is fixed with concrete TTL values.
- Object key naming convention is fixed and unambiguous.
- Versioning/retention/accidental-deletion recovery baseline is documented.
- Retention policy change operation flow is documented.
- References are linked from `docs/DATABASE.md` and runbooks index.
