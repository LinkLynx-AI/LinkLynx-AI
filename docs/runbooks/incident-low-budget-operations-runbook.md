# Incident Low-Budget Operations Runbook

- Status: Draft
- Last updated: 2026-03-29
- Owner scope: low-budget `prod-only` incident / capacity baseline
- References:
  - `docs/runbooks/cloud-monitoring-low-budget-operations-runbook.md`
  - `docs/runbooks/cloud-armor-low-budget-operations-runbook.md`
  - `docs/runbooks/postgres-pitr-runbook.md`
  - `LIN-1020`

## 1. Purpose and scope

This runbook defines the initial operating flow for the low-budget `prod-only` path.

In scope:

- first-response incident flow
- Discord mention and ownership handoff
- initial capacity assumptions and scale triggers
- Chaos Engineering readiness conditions

Out of scope:

- PagerDuty / Opsgenie / dedicated on-call tooling
- multi-region / multi-cloud DR execution
- standard-path full operating model

## 2. Contact baseline

Initial incident mentions go to:

- `hirwatan`
- `sabe`
- `miwasa`

Communication baseline:

1. Open an incident thread in Discord.
2. Mention the three baseline contacts above.
3. Record:
   - start time
   - affected surface (`/health`, `/ws`, DB, WAF, login, etc.)
   - user-visible impact
   - current mitigation owner

## 3. Severity guide

- `SEV-1`
  - `/health` unavailable from public edge
  - WebSocket connect path broadly unavailable
  - data-loss or restore decision candidate
- `SEV-2`
  - sustained Cloud SQL CPU pressure
  - repeated Rust API restart burst
  - Cloud Armor false positive that blocks legitimate core traffic
- `SEV-3`
  - partial degradation
  - noisy alert without broad user impact
  - capacity warning without current outage

## 4. First 15 minutes

1. Confirm whether the issue is edge, workload, database, or security-policy related.
2. Check Cloud Monitoring dashboard and the active alert policy first.
3. Follow the linked specialist runbook:
   - Rust restart / Cloud SQL pressure: `cloud-monitoring-low-budget-operations-runbook.md`
   - WAF false positive / security attach: `cloud-armor-low-budget-operations-runbook.md`
   - restore decision: `postgres-pitr-runbook.md`
4. Decide one of:
   - mitigate in place
   - roll back recent Terraform / image change
   - enter database incident handling
5. Record the decision and owner in the Discord incident thread.

## 5. Capacity assumptions

This baseline is intentionally conservative because the low-budget path uses:

- single region: `us-east1`
- `prod-only` cluster
- one initial runtime path centered on Rust API
- low-budget Cloud SQL baseline

Planning envelope:

- registered users: `10,000 - 100,000`
- active users may eventually reach the same order of magnitude, but scaling decisions must use observed traffic rather than account count alone

Initial operating envelope for the low-budget path:

- peak concurrent WebSocket connections: `500 - 2,000`
- sustained message ingress: `50 - 200 msg/s`
- REST API latency target: `P95 <= 300ms`, `P99 <= 800ms`
- WebSocket reconnect target during incidents/rollouts: `P95 <= 10s`

These are operating assumptions, not product guarantees.

## 6. Scale triggers

Open a capacity review issue and consider moving toward the standard path when any of the following becomes sustained:

1. peak concurrent WebSocket connections exceed `2,000`
2. message ingress exceeds `200 msg/s` for 15 minutes
3. Cloud SQL CPU alert repeats for 3 consecutive windows after query / rollout checks
4. Rust API restart burst repeats outside rollout windows
5. REST `P95` exceeds `300ms` or `P99` exceeds `800ms` for 3 consecutive 5-minute windows
6. monthly cost forecast no longer fits the low-budget target

Priority order:

1. optimize obvious regressions
2. tighten rollout or WAF configuration if the issue is policy-related
3. scale up instance / cluster profile
4. if scaling alone is no longer enough, move to the standard path (`staging`, broader observability, fuller operating model)

## 7. Postmortem requirement

Create a postmortem when:

- any `SEV-1` incident occurs
- a `SEV-2` incident lasts more than 30 minutes
- rollback or PITR is executed
- user-visible degradation repeats for the same root cause

Use `docs/runbooks/postmortem-low-budget-template.md`.

## 8. Chaos readiness conditions

Do not start Chaos Engineering just because of a date.

The low-budget path is ready only when all are true:

1. Cloud Monitoring and Cloud Armor baselines are active.
2. rollback paths for image, Terraform, and DB restore have been tabletop-reviewed.
3. the incident flow has been exercised at least once as a tabletop.
4. there is a disposable rehearsal environment or the team has moved to a standard path with safer pre-prod validation.
5. no unresolved recent `SEV-1` incident is still open.

For the current single-cluster `prod-only` path, prefer tabletop and game-day drills before fault injection.

## 9. Tabletop checklist

1. simulate a Rust API restart burst
2. simulate a Cloud SQL CPU alert
3. simulate a Cloud Armor false positive
4. verify that Discord mention, owner assignment, mitigation choice, and postmortem follow-up can all be recorded without ambiguity
