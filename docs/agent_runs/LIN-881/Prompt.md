# Prompt.md (Spec / Source of truth)

## Goals
- Reopen `LIN-881` and implement the missing AuthZ boundary fixes.
- Enforce the stream-equivalent AuthZ check for WS text messages.
- Move `/internal/authz/metrics` behind the internal protected REST boundary.
- Add regression coverage in `rust/apps/api/src/main/tests.rs`.

## Non-goals
- Do not change WS payload formats or message types.
- Do not change the AuthZ failure contract (`403/503`, `1008/1011`).
- Do not broaden scope beyond the two issue items and their regression tests.

## Deliverables
- Code changes for WS text AuthZ enforcement and protected internal metrics routing.
- Regression tests covering authorized and unauthorized WS text behavior plus internal metrics protection.
- Validation and review evidence for PR creation.

## Done when
- [x] `LIN-881` is reopened and tracked on a dedicated branch.
- [x] Current behavior is compared against `LIN-881` acceptance criteria.
- [x] Relevant ADR-004 contract impact is called out.
- [x] Targeted regression tests are added and passing.
- [x] PR is created with validation and review evidence.

## Constraints
- Perf: Keep the WS text fix on the existing fast path with no broader refactor.
- Security: Treat AuthZ gaps as fail-close contract violations.
- Compatibility: No payload or response contract changes in this run.
