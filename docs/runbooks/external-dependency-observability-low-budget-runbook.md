# External Dependency Observability Low-budget Runbook

- Status: Draft
- Last updated: 2026-03-29
- Owner scope: low-budget `prod-only` external dependency observability handoff
- References:
  - `docs/runbooks/cloud-monitoring-low-budget-operations-runbook.md`
  - `docs/runbooks/scylla-external-low-budget-operations-runbook.md`
  - `docs/runbooks/managed-messaging-cloud-low-budget-operations-runbook.md`
  - `docs/runbooks/search-elastic-cloud-low-budget-operations-runbook.md`

## 1. Purpose and scope

This runbook defines how the low-budget `prod-only` path observes external dependencies without
adding a full provider-metrics ingestion stack.

In scope:

- handoff between Cloud Monitoring baseline and provider-side manual checks
- low-budget check sources for Scylla, Redpanda Cloud, Synadia Cloud / NATS, and Elastic Cloud
- first alert seeds and incident routing baseline

Out of scope:

- automatic provider metrics export into Cloud Monitoring
- Prometheus / Grafana / Loki / Tempo rollout
- provider onboarding, auth, or network implementation
- full standard observability model that belongs to `LIN-972`

## 2. Baseline choice

- `Cloud Monitoring + Cloud Logging` remains the system of record for GKE, Rust API, and Cloud SQL.
- External dependency visibility stays split:
  - workload-local health signal when available
  - provider console or provider status page when dependency health is external
- Manual checks are acceptable in the low-budget path as long as the check source is explicit and
  the responder can tell which runbook to open next.

## 3. Check source map

| Dependency | First check source | Secondary source | Next runbook |
| --- | --- | --- | --- |
| External Scylla | `GET /internal/scylla/health` | external owner signal / backup evidence | `scylla-external-low-budget-operations-runbook.md` |
| Redpanda Cloud | provider console metrics and consumer lag view | provider status page / replay evidence | `managed-messaging-cloud-low-budget-operations-runbook.md` |
| Synadia Cloud / NATS | provider console or status page | app-side reconnect / publish error signal | `managed-messaging-cloud-low-budget-operations-runbook.md` |
| Elastic Cloud | deployment health in provider console | snapshot / restore / SLM signals | `search-elastic-cloud-low-budget-operations-runbook.md` |

## 4. Alert seed baseline

Low-budget path should treat these as the first external-dependency alert seeds:

- Scylla:
  - `/internal/scylla/health` reports persistent `connect_failed`, `connect_timeout`, or schema drift
  - backup freshness becomes unknown or exceeds the allowed recovery window
- Redpanda Cloud:
  - consumer lag grows without convergence
  - produce success rate drops or replay stalls
- Synadia Cloud / NATS:
  - reconnect storm or publish error rate stays elevated
  - auth failures appear after credential rotation
- Elastic Cloud:
  - deployment health stays degraded beyond a short maintenance window
  - no successful snapshot is visible inside the expected window

## 5. Triage handoff

1. Start in `Cloud Monitoring` to confirm whether the symptom is application-side, database-side, or
   likely external.
2. If the symptom points to an external dependency, switch immediately to the relevant check source
   from section 3.
3. Open the dependency-specific runbook before attempting mitigation.
4. Record whether the issue is:
   - provider outage
   - credential / auth incident
   - workload wiring regression
   - backup / restore readiness gap

## 6. Low-budget operating rule

- Do not block on building a full unified dashboard before documenting the manual check path.
- Do not invent silent ownership assumptions; if the provider owns health visibility, name that
  source explicitly.
- When the same dependency causes repeated incidents, promote it to standard path `LIN-972` or the
  relevant provider issue for automated ingestion.

## 7. Handoff boundary to standard path

Keep the following in `LIN-972`:

- unified observability stack decision
- provider metrics ingestion / dashboard automation
- cross-service SLO rollup with dependency overlays
- long-term alert tuning and noise reduction for external providers
