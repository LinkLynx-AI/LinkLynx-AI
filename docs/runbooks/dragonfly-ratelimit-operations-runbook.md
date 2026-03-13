# Dragonfly RateLimit Operations Runbook (Draft)

- Status: Draft
- Last updated: 2026-03-06
- Owner scope: v1 minimal rate-limit / spam protection baseline
- References:
  - `database/contracts/lin139_runtime_contracts.md`
  - [ADR-005 Dragonfly Outage RateLimit Failure Policy (Hybrid)](../adr/ADR-005-dragonfly-ratelimit-failure-policy.md)
  - `LIN-795`

## 1. Purpose and scope

This runbook fixes one operational baseline for the minimal v1 rate-limit controls on invite, moderation, and message-create surfaces.

In scope:

- Operation class mapping for current v1 minimal REST surfaces
- `429 + Retry-After` verification steps
- Dragonfly degraded enter/exit monitoring conditions
- Failure simulation and threshold validation in controlled test code
- Recovery observation and warm-up checks

Out of scope:

- Dragonfly provider implementation details
- Full L2 bucket reconstruction algorithm changes
- Rate-limit expansion to other surfaces

## 2. Fixed baseline values

| item | baseline |
| --- | --- |
| Invite access limit | `10/min` |
| Moderation action limit | `5/min` |
| Message create limit | `30/min` |
| Degraded enter | `30s` continuous healthcheck failure or `>= 20%` L2 error rate in `1m` after `10` samples |
| Degraded exit | `10m` healthy streak and `< 1%` L2 error rate |
| Fail-close retry-after | `60s` |

## 3. Operation class mapping

| route surface | class | degraded behavior |
| --- | --- | --- |
| `GET /v1/guilds/{guild_id}/invites/{invite_code}` | `high-risk abuse surface` | fail-close |
| `PATCH /v1/moderation/guilds/{guild_id}/members/{member_id}` | `high-risk abuse surface` | fail-close |
| `POST /v1/guilds/{guild_id}/channels/{channel_id}/messages` | `core write path` | degraded fail-open (L1 only) |
| `POST /v1/dms/{channel_id}/messages` | `core write path` | degraded fail-open (L1 only) |

## 3.1 Implementation alignment

| route surface | rate-limit action | deny / limited reason | required reject log fields |
| --- | --- | --- | --- |
| `GET /v1/guilds/{guild_id}/invites/{invite_code}` | `InviteAccess` | `rate_limit_exceeded` / `dragonfly_degraded_fail_close` | `request_id`, `reason`, `principal_id?`, `guild_id`, `resource`, `action`, `decision_source` |
| `POST /v1/invites/{invite_code}/join` | `InviteAccess` | `rate_limit_exceeded` / `dragonfly_degraded_fail_close` | `request_id`, `reason`, `principal_id`, `resource`, `action`, `decision_source` |
| `PATCH /v1/moderation/guilds/{guild_id}/members/{member_id}` | `ModerationAction` | `rate_limit_exceeded` / `dragonfly_degraded_fail_close` | `request_id`, `reason`, `principal_id`, `guild_id`, `resource`, `action`, `decision_source` |
| `POST /v1/guilds/{guild_id}/channels/{channel_id}/messages` | `MessageCreate` | `rate_limit_exceeded` only after L1 exhaustion | `request_id`, `reason`, `principal_id`, `guild_id`, `channel_id`, `resource`, `action`, `decision_source` |
| `POST /v1/dms/{channel_id}/messages` | `MessageCreate` | `rate_limit_exceeded` only after L1 exhaustion | `request_id`, `reason`, `principal_id`, `channel_id`, `resource`, `action`, `decision_source` |

## 4. Exposure boundary

- No public or protected REST endpoint is exposed to mutate degraded state.
- Failure/degraded drills for this phase are validated through automated Rust tests and direct service hooks in controlled environments only.

## 5. Verification procedures

### 5.1 Scenario A: rate limit exceeded

Procedure:

1. Send repeated requests to one protected surface with the same principal.
2. Exceed the configured per-minute threshold.
3. Confirm the response becomes `429 Too Many Requests`.
4. Confirm `Retry-After` is present.

Pass criteria:

- `429` is returned only after threshold exceed.
- `Retry-After` is present and non-zero.

### 5.2 Scenario B: Dragonfly degraded -> high-risk fail-close

Procedure:

1. In a controlled test harness, inject repeated failure observations into the rate-limit monitor.
2. Wait until degraded enters by threshold.
3. Call invite or moderation endpoint.
4. Confirm request is rejected with `429 + Retry-After`.
5. Confirm the rejection occurs only after degraded entry.

Pass criteria:

- degraded state becomes `true`.
- invite / moderation clearly fail-close with no ambiguous behavior.

### 5.3 Scenario C: Dragonfly degraded -> message create continuity

Procedure:

1. Enter degraded mode as in Scenario B.
2. Call one of the message create endpoints.
3. Confirm the request still succeeds while local fixed-window budget remains.

Pass criteria:

- message create continues under degraded state.
- L1 threshold still applies normally.

### 5.4 Scenario D: recovery and exit

Procedure:

1. After degraded entry, submit healthy observations in the same controlled harness.
2. Keep healthy streak for at least `10m`.
3. Keep L2 error rate below `1%`.
4. Confirm degraded exits.
5. Observe for another `10m` warm-up window.

Pass criteria:

- degraded returns to `false` only after both exit conditions are met.
- no full bucket recomputation is required.

## 6. Suggested alerts

1. degraded entered immediately
2. degraded duration exceeds `15m`
3. `dragonfly_unavailable_total` keeps increasing for `5m`
4. `high_risk_fail_close_total` spikes above baseline

## 7. Operational record template

```markdown
### Dragonfly RateLimit Incident Record

- Date:
- Environment:
- Trigger:
- Degraded entered at:
- High-risk fail-close observed: yes/no
- Message create continuity observed: yes/no
- Degraded exited at:
- Warm-up result:
- Follow-up issues:
```
