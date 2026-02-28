# LIN-620 Plan

## Execution order
1. LIN-621: remove local auth DB assets and SoR inconsistencies.
2. LIN-622: implement principal auto provisioning on first auth.
3. LIN-624: enforce email_verified across REST/WS shared auth flow.
4. LIN-623: document/reset-runtime alignment to Firebase delegation.
5. LIN-620: integrate and summarize parent issue completion.

## Validation commands
- make rust-lint
- make validate
- make db-schema-check

## Acceptance highlights
- Removed columns/tables are absent from schema snapshot.
- Provisioning succeeds idempotently and fails closed on invalid/dependency/conflict cases.
- AUTH_EMAIL_NOT_VERIFIED maps to 403 + WS1008.
- Runbook and DB docs match runtime behavior.
