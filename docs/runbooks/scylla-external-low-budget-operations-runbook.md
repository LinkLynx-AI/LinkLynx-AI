# Scylla External Low-budget Operations Runbook

- Status: Draft
- Last updated: 2026-03-29
- Owner scope: low-budget `prod-only` external Scylla ops / backup baseline
- References:
  - `database/contracts/lin589_scylla_sor_partition_baseline.md`
  - `docs/runbooks/scylla-node-loss-backup-runbook.md`
  - `docs/runbooks/scylla-low-budget-runtime-operations-runbook.md`
  - `LIN-1023`

## 1. Purpose and scope

This runbook defines the low-budget `prod-only` operating baseline for external Scylla after the
runtime wiring baseline is in place.

In scope:

- ownership boundary between external Scylla owner and LinkLynx
- backup / restore / schema ownership baseline
- incident triage and monitoring seed
- documentation of the current auth / TLS / networking gap

Out of scope:

- Scylla cluster provisioning or provider account setup
- Secret Manager backed runtime consumption for Scylla credentials
- TLS / auth / private connectivity automation
- application query design or schema redesign
- full standard operating model that belongs to `LIN-970`

## 2. Hosting baseline

- Low-budget path treats Scylla as an external dependency outside Terraform ownership.
- Runtime env wiring for `rust-api-smoke` is handled by `LIN-1023`.
- SoR boundary remains defined by `LIN-589`; message body durability stays with Scylla.
- Current low-budget posture allows manual dependency ownership outside Terraform.
- If auth / TLS / private connectivity become required, move to standard path `LIN-970`.

## 3. Responsibility split

| Area | External Scylla owner | LinkLynx |
| --- | --- | --- |
| Cluster/node availability | owns | monitors status and opens incident |
| Backup execution on the actual cluster | performs or exposes evidence | verifies freshness and restore readiness |
| Snapshot artifact and schema manifest custody | provides or confirms | records decision and recovery linkage |
| Keyspace/table semantic ownership | no | owns via LIN-589 contract |
| Runtime env wiring in workload | no | owns via `LIN-1023` |
| Restore execution decision | no | owns |
| Write fail-close decision when quorum is uncertain | no | owns via LIN-589 / runbook |
| Auth / TLS / network productionization | no | follow-up in `LIN-970` |

## 4. Backup / restore baseline

Low-budget path keeps the minimum backup / restore policy aligned with the Scylla node-loss runbook.

Required baseline:

1. Snapshot data for the `chat` keyspace
2. Keyspace/table schema snapshot captured with the same backup tag
3. Backup execution record with owner, scope, timestamp, and artifact location

Guardrails:

- Do not treat VM or disk snapshots alone as sufficient without schema preservation.
- Do not reduce backup evidence to “the provider should have it”.
- If backup freshness is unknown, pause risky changes before rollout.
- Restore follows the read-first, write-later staged resume baseline from the main Scylla runbook.

## 5. Monitoring seed

Low-budget path should at minimum observe these signals:

- `/internal/scylla/health` status and reason
- connect timeout / connect failure count
- latest-N retrieval latency (`P95 / P99`)
- read / write error rate against Scylla-backed paths
- external node health or quorum-risk indicator when surfaced by the owner
- backup freshness / age of last successful snapshot
- storage or capacity headroom indicator

Suggested first alert seeds:

- `connect_failed` / `connect_timeout` persists across consecutive windows
- latest-N latency exceeds the `LIN-589` review target for sustained windows
- backup freshness exceeds the allowed recovery window
- node-loss or quorum-risk indication stays active beyond a short observation window

## 6. Incident triage baseline

Classify the incident before taking action.

1. Reachability / auth / TLS issue
- Symptoms: `connect_failed`, `connect_timeout`, auth handshake failure, or routing break.
- Immediate posture: keep current write/read decision aligned with consistency confidence; escalate
  networking/auth ownership if the issue is outside workload wiring.
- Next action: verify runtime env baseline first, then confirm external dependency reachability.

2. Schema / keyspace drift
- Symptoms: `keyspace_missing`, `table_missing`, or schema mismatch after rollout or restore.
- Immediate posture: stop risky writes if consistency is uncertain.
- Next action: verify the expected schema artifact and restore the baseline schema before traffic
  resume.

3. Node-loss / backup risk
- Symptoms: node down, quorum risk, backup freshness unknown, or restore readiness unclear.
- Immediate posture: follow LIN-589 continuation vs fail-close rule.
- Next action: switch to the Scylla node-loss / backup runbook and record the explicit recovery
  decision.

## 7. Handoff boundary to standard path

Keep the following in `LIN-970`:

- ScyllaDB Cloud or managed-provider onboarding path
- network / auth / TLS productionization
- secret distribution / rotation path
- staging / prod connectivity smoke and rotation rehearsal
- provider-specific automation and full observability integration
