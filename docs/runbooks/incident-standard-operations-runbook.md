# Incident Standard Operations Runbook

- Status: Draft
- Last updated: 2026-03-30
- Owner scope: standard path `staging` / `prod` incident / capacity baseline
- References:
  - [Observability Standard Operations Runbook](./observability-standard-operations-runbook.md)
  - [Security Standard Operations Runbook](./security-standard-operations-runbook.md)
  - [Cloud SQL PostgreSQL Standard Operations Runbook](./cloud-sql-postgres-standard-operations-runbook.md)
  - [Dragonfly Standard Operations Runbook](./dragonfly-standard-operations-runbook.md)
  - [ScyllaDB Cloud Standard Operations Runbook](./scylla-cloud-standard-operations-runbook.md)
  - [Managed Messaging Cloud Standard Operations Runbook](./managed-messaging-cloud-standard-operations-runbook.md)
  - [Search Elastic Cloud Standard Operations Runbook](./search-elastic-cloud-standard-operations-runbook.md)
  - [Postmortem Standard Template](./postmortem-standard-template.md)
  - `LIN-974`

## 1. Purpose and scope

This runbook defines the initial operating model for the standard path.

In scope:

- first-response incident flow
- Discord-based incident communication baseline
- capacity assumptions and scale triggers
- postmortem requirement and template handoff
- Chaos Engineering readiness conditions

Out of scope:

- PagerDuty / Opsgenie adoption
- multi-region / multi-cloud DR execution
- automated chaos tooling

## 2. Contact and role baseline

Initial incident mentions go to:

- `hirwatan`
- `sabe`
- `miwasa`

Required roles for any `SEV-1` or sustained `SEV-2`:

- Incident Commander: owns mitigation decisions
- Comms owner: owns Discord updates
- Scribe: owns timeline and action log

If a role is unassigned after 5 minutes, the first responder takes Incident Commander and assigns the remaining roles explicitly.

## 3. Severity guide

- `SEV-1`
  - public API health path broadly unavailable
  - WebSocket connect path broadly unavailable
  - Cloud SQL / Scylla / search restore decision candidate
  - widespread user-visible write-path failure
- `SEV-2`
  - repeated SLO breach with user-visible degradation
  - search degraded beyond ADR-003 tolerance and requiring restore/reindex planning
  - repeated dependency alert storms after rollout windows close
- `SEV-3`
  - localized degradation
  - early capacity pressure without present outage
  - noisy or false-positive alert

## 4. First 15 minutes

1. Open a Discord incident thread and mention:
   - `hirwatan`
   - `sabe`
   - `miwasa`
2. Record:
   - start time
   - severity
   - impacted surfaces (`REST`, `WS`, `Cloud SQL`, `Dragonfly`, `Scylla`, `messaging`, `search`, `edge`)
   - current incident commander
3. Check the alert source first:
   - Alertmanager / Grafana
   - Cloud Armor / deploy history
   - provider console for Scylla / Redpanda / NATS / Elastic Cloud if dependency-related
4. Choose one immediate path:
   - mitigate in place
   - roll back recent rollout / GitOps change / Terraform change
   - enter dependency-specific recovery
5. Link the specialist runbook in the thread and assign the next action owner.

## 5. Initial capacity assumptions

These are planning envelopes for the standard path, not contractual product guarantees.

| Metric | Initial envelope |
| --- | --- |
| Registered users | `100,000 - 1,000,000` |
| DAU | `10,000 - 100,000` |
| Peak concurrent WebSocket connections | `2,000 - 10,000` |
| Sustained message ingress | `200 - 1,000 msg/s` |
| REST latency target | `P95 <= 250ms`, `P99 <= 800ms` |
| WebSocket reconnect target | `P95 <= 5s` during rollout, `P95 <= 10s` during incident recovery |
| Search reflect lag | ADR-003 baseline (`P95 <= 60s` for v0) |

Capacity planning rule:

- account count alone must not trigger scale-out
- observed traffic, latency, DB pressure, search lag, and cost forecast drive the decision

## 6. Expansion and optimization triggers

Open a capacity review when any of the following is sustained:

1. peak concurrent WebSocket connections exceed `10,000` for 15 minutes
2. message ingress exceeds `1,000 msg/s` for 15 minutes
3. REST `P95 > 250ms` or `P99 > 800ms` for 3 consecutive 5-minute windows
4. search lag exceeds ADR-003 threshold for 3 consecutive 5-minute windows
5. repeated Cloud SQL CPU / connection pressure persists after query and rollout checks
6. repeated Scylla / Dragonfly / messaging dependency pressure persists after operator mitigation
7. monthly infra cost forecast exceeds the current acceptable budget band before usage or margin justifies it

Decision order:

1. remove obvious regressions
2. reduce rollout or policy-induced pressure
3. scale the current profile
4. if scaling stops being economical, open architecture review for the next phase

## 7. Postmortem requirement

Create a postmortem when any of the following is true:

- any `SEV-1`
- a `SEV-2` lasts more than 30 minutes
- rollback, PITR, restore, or reindex execution is required
- the same root cause repeats within 14 days

Use `docs/runbooks/postmortem-standard-template.md`.

## 8. Chaos readiness conditions

Do not start Chaos Engineering because of a fixed date.

The standard path is ready only when all are true:

1. standard observability baseline is active and trusted enough for incident triage
2. rollback flows for GitOps, Terraform, Cloud SQL, and search recovery have been tabletop-reviewed
3. at least one tabletop has exercised Discord incident flow through postmortem close
4. staging exists and can be used for restore / reindex / dependency rehearsal
5. no unresolved recent `SEV-1` remains open
6. alert noise is below the point where responders cannot distinguish real degradation

Start with tabletop and game-day drills before automated fault injection.

## 9. Tabletop baseline

Run the following drills in order:

1. API / WS SLO breach
2. Cloud SQL pressure leading to rollback decision
3. Cloud Armor false positive on a serving route
4. Elastic Cloud search degradation requiring provider check and reindex decision

Success means:

- Discord thread starts quickly
- IC / comms / scribe are unambiguous
- linked runbooks are enough to choose a next action
- a postmortem can be opened without extra process design
