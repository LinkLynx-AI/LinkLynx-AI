# ADR-005 Dragonfly Outage RateLimit Failure Policy (Hybrid)

- Status: Accepted
- Date: 2026-02-26
- Related:
  - [LIN-580](https://linear.app/linklynx-ai/issue/LIN-580)
  - [LIN-584](https://linear.app/linklynx-ai/issue/LIN-584)
  - [LIN-585](https://linear.app/linklynx-ai/issue/LIN-585)
  - [LIN-586](https://linear.app/linklynx-ai/issue/LIN-586)
  - [LIN-587](https://linear.app/linklynx-ai/issue/LIN-587)
  - [LIN-596](https://linear.app/linklynx-ai/issue/LIN-596)
  - [ADR-001](./ADR-001-event-schema-compatibility.md)
  - [LIN-139 runtime contracts](../../database/contracts/lin139_runtime_contracts.md)

## Context

In v0, rate limiting uses local L1 GCRA/TAT as the primary path and Dragonfly (Redis-compatible) as L2 fallback/safety valve.
LIN-584 requires fixing a single outage policy before Edge/Auth/Session contracts proceed.
If the Dragonfly outage behavior is not fixed, teams can diverge between security-first and UX-first choices, causing inconsistent abuse handling and rollback decisions.

## Decision

### 1. Policy model

We adopt a hybrid policy: fail-close only for high-risk abuse surfaces, and degraded fail-open for continuity-sensitive paths.

| operation class | representative examples | behavior during Dragonfly outage |
| --- | --- | --- |
| High-risk abuse surface | auth attempts, invite abuse controls, account protection actions | `fail-close` |
| Core write path | message create/update/delete and other core writes | `degraded fail-open` (L1-only decision continues) |
| Read/session continuity | history read, WS connect/resume/heartbeat continuity checks | `degraded fail-open` (L1-only decision continues) |

### 2. Degraded mode transition criteria

Enter degraded mode when either condition is true:

- Dragonfly healthcheck failures are continuous for about 30 seconds, or
- L2 error rate is `>= 20%` in a 1-minute window

Exit degraded mode only when both are true:

- Dragonfly is continuously healthy for 10 minutes, and
- L2 error rate is `< 1%` during that interval

### 3. Request handling rules by class

- High-risk abuse surface:
  - Reject by default (`fail-close`) when L2 is unavailable.
  - Keep explicit deny reason for audit/review and incident investigation.
- Core write path:
  - Continue with L1-only evaluation in degraded mode.
  - Do not block write flow solely because Dragonfly L2 is unavailable.
- Read/session continuity:
  - Continue with L1-only evaluation in degraded mode.
  - Prefer service continuity and recoverability over strict L2-based enforcement.

### 4. Recovery and bucket re-synchronization policy

- Full bucket re-computation/backfill is not performed in LIN-584 scope.
- Recovery uses delayed reconstruction from the existing L1/L2 contract, including `SET ... NX EX` initialization for missing L2 state.
- After degraded-mode exit, operate a 10-minute warm-up period with tightened monitoring.
- If drift indicators keep increasing after warm-up, escalate to operations follow-up issue instead of changing algorithm in this issue.

### 5. Alert thresholds and operational draft

Minimum alert candidates:

1. Degraded mode entered (immediate page to on-call)
2. Degraded mode duration exceeds 15 minutes
3. L2 error rate remains `>= 20%` for 3 consecutive 1-minute windows
4. High-risk fail-close reject rate spike exceeds agreed baseline

Minimum response sequence:

1. Confirm outage scope (Dragonfly node/cluster/network path).
2. Confirm degraded-mode class behavior is active as designed.
3. Stabilize L2 path and verify exit criteria.
4. Run 10-minute warm-up observation and record outcome.
5. Document incident summary and follow-up actions.

### 6. Expected impact ranges (tabletop baseline)

These values are tabletop estimates for policy review, not production measurements.
They must be replaced with measured data in follow-up issues.

| operation class | expected pass-through during outage | expected rejection during outage | rationale |
| --- | --- | --- | --- |
| High-risk abuse surface | `0-5%` | `95-100%` | security-first default under uncertain distributed state |
| Core write path | `85-98%` | `2-15%` | keep core product path available with bounded protection from L1 |
| Read/session continuity | `90-99%` | `1-10%` | continuity-first for reconnect/read usability |

## Scope boundaries

In scope:

- Outage behavior policy fixation
- Trade-off rationale and operation baseline
- Recovery/re-synchronization policy at runbook level

Out of scope:

- RateLimit algorithm changes
- Runtime implementation changes
- New provider introduction or architecture changes

## Acceptance criteria mapping

| issue acceptance criterion | decision coverage in this ADR |
| --- | --- |
| Functional: define outage behavior and coverage scope | sections 1, 2, 3 define class-specific behavior and applicability |
| Performance: describe expected rejection/pass-through impact | section 6 provides class-based impact ranges |
| Outage handling: define service continuity level | sections 2 and 3 define degraded entry/exit and continuity model |
| Operations: draft alerts and procedures | section 5 defines alert candidates and response sequence |

## ADR-001 compatibility checklist result

Result: PASS / N.A. (no event schema changes in this ADR)

- Additive-only schema rule: N.A. (no payload field changes)
- Consumer impact: no event contract shape changes
- Monitoring and rollback readiness: covered by degraded thresholds and operational sequence
- Documentation scope: ADR and runtime-contract references are bounded to rate-limit outage policy

## Verification scenarios

1. A tabletop Dragonfly-stop scenario yields one unambiguous behavior per operation class.
2. Degraded enter/exit can be decided only from the threshold rules in this ADR.
3. Recovery sequence can be executed without requiring algorithm changes or full backfill.
4. LIN-585/586/587 can reference this ADR as the policy source of truth.

## Consequences

- Security vs UX trade-off is fixed before dependent issues proceed.
- Edge/Auth/Session contracts can depend on one outage-policy baseline.
- Future implementation work can focus on execution quality instead of re-deciding policy.
