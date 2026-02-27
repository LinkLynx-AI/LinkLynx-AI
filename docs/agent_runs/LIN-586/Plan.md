# LIN-586 Plan

## Milestones
1. LIN-614: Add auth_identities schema contract.
2. LIN-615: Add Firebase ID token verifier with JWKS cache.
3. LIN-616: Add uid->principal_id resolver with cache + DB fallback abstraction.
4. LIN-617: Add REST auth middleware and context injection.
5. LIN-619: Add WS auth on connect + in-band reauth flow.
6. LIN-618: Add auth operations docs (error policy, logs/metrics, runbook).

## Validation commands
- make rust-lint
- make validate (best effort, note if unrelated failures occur)

## Acceptance checks
- Token success/failure behavior maps to agreed error contract.
- principal_id mapping is unique and constrained in schema.
- WS closes with deterministic vs dependency-failure close code mapping.
