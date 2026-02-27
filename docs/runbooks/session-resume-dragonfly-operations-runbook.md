# Session/Resume Dragonfly Operations Runbook (Draft)

- Status: Draft
- Last updated: 2026-02-27
- Owner scope: v0 session continuity baseline for WS reconnect/resume
- References:
  - `database/contracts/lin587_session_resume_runtime_contract.md`
  - `database/contracts/lin139_runtime_contracts.md`
  - [ADR-005 Dragonfly Outage RateLimit Failure Policy (Hybrid)](../adr/ADR-005-dragonfly-ratelimit-failure-policy.md)
  - [Edge REST/WS Routing and WS Drain Runbook](./edge-rest-ws-routing-drain-runbook.md)
  - [Firebase Auth / principal_id Operations Runbook](./auth-firebase-principal-operations-runbook.md)
  - `LIN-587`

## 1. Purpose and scope

This runbook fixes one operational baseline for v0 session continuity using Dragonfly-backed volatile session state.

In scope:

- Session/resume/TTL operational baseline
- Verification steps for short-disconnect resume success
- Behavior for TTL expiry fallback
- Dragonfly outage degraded behavior for continuity class
- TTL rollout and rollback procedure

Out of scope:

- Runtime implementation details in Rust code
- v1 advanced session routing/distribution
- Dragonfly persistence guarantees

## 2. Fixed baseline values

| item | baseline |
| --- | --- |
| Session TTL | `180s` |
| Heartbeat interval | `30s` |
| Liveness timeout | `90s` |
| Resume success target | `>= 95%` (Dragonfly healthy, short disconnect scenario) |

## 3. Session and resume contract summary

- Session state model: `active` / `resumable` / `expired`
- Dragonfly key: `sess:v0:{session_id}`
- Mandatory fields: `principal_id`, `issued_at`, `expires_at`, `last_heartbeat_at`, `last_disconnect_at`, `resume_nonce`
- Resume success requires:
1. session key exists
2. TTL not expired
3. same principal
4. valid authentication context

On resume failure, execute:

1. full re-auth
2. history re-fetch guidance

## 4. Verification procedures

### 4.1 Scenario A: short disconnect -> resume success

Preconditions:

1. Dragonfly is healthy.
2. Test user can establish authenticated WS connection.

Procedure:

1. Connect WS and complete auth handshake.
2. Confirm session key creation for `sess:v0:{session_id}`.
3. Disconnect client for less than `180s`.
4. Reconnect with same principal and resume token/session_id.
5. Confirm resume succeeds and fallback metric does not increment.

Pass criteria:

- `session_resume_success_total` increments.
- `session_resume_fallback_total` does not increment for the same attempt.

### 4.2 Scenario B: TTL expiry -> fallback

Preconditions:

1. Dragonfly is healthy.
2. Existing resumable session is created.

Procedure:

1. Wait until session key TTL expires (> `180s` without successful resume).
2. Attempt resume using expired session_id.
3. Verify resume rejection reason is `session_expired` or `session_not_found`.
4. Verify flow transitions to full re-auth.
5. Verify client receives history re-fetch guidance.

Pass criteria:

- `session_resume_fallback_total{reason="session_expired"}` or `session_not_found` increments.
- New authenticated session can be established after fallback.

### 4.3 Scenario C: Dragonfly outage -> degraded continuity

Preconditions:

1. Staging environment with controllable Dragonfly stop/start.
2. Session/resume metrics dashboard is available.

Procedure:

1. Simulate Dragonfly outage.
2. Verify new authenticated connections continue where possible.
3. Attempt resume during outage and observe best-effort failures.
4. Verify failures route to fallback path (full re-auth + history re-fetch).
5. Restore Dragonfly and confirm recovery trend in resume metrics.

Pass criteria:

- Service continuity remains available for new sessions.
- Resume quality degrades without ambiguous behavior.
- Outage and fallback metrics provide clear diagnosis signals.

## 5. Degraded behavior policy (ADR-005 alignment)

Session continuity is treated as `Read/session continuity` class from ADR-005.

Operational behavior during Dragonfly outage:

1. Apply degraded fail-open for continuity-sensitive path.
2. Do not hard-fail all reconnect attempts solely due to Dragonfly unavailability.
3. Permit resume failure and immediately route to fallback.
4. Accept temporary quality degradation in presence/session continuity.

## 6. Metrics and alert viewpoints

Required metrics:

- `session_resume_attempt_total`
- `session_resume_success_total`
- `session_resume_fallback_total{reason}`
- `session_heartbeat_timeout_total`
- `session_dragonfly_unavailable_total`

Operational targets:

- `resume_success_rate >= 95%` (Dragonfly healthy)

Suggested alerts:

1. `resume_success_rate < 95%` for 10 consecutive minutes in healthy state.
2. `session_dragonfly_unavailable_total` continues increasing for 5 minutes.
3. `session_heartbeat_timeout_total` spikes above recent baseline.

## 7. TTL change rollout procedure

Use staged rollout only:

1. Staging:
- Apply TTL change.
- Run scenario A/B verification.
2. Canary:
- Apply to limited production slice.
- Observe metrics for at least 30 minutes.
3. Full rollout:
- Expand only if canary meets thresholds.

Rollback triggers:

1. `resume_success_rate` drops below `95%` and does not recover within 10 minutes.
2. `session_resume_fallback_total` shows sustained abnormal increase after TTL change.
3. `session_heartbeat_timeout_total` rises sharply compared to pre-change baseline.

Rollback action:

1. Revert TTL to previous value.
2. Keep fallback path active.
3. Record incident and open follow-up issue if needed.

## 8. Operational record template

```markdown
### Session/Resume TTL Change Record

- Date:
- Environment:
- Previous TTL:
- New TTL:
- Staging verification result:
- Canary window:
- Resume success rate:
- Fallback reason distribution:
- Rollback executed: yes/no
- Follow-up issues:
```
