# Managed Messaging Cloud Standard Operations Runbook

- Status: Draft
- Last updated: 2026-03-29
- Owner scope: standard path `staging` / `prod` Redpanda Cloud / Synadia Cloud connection baseline
- References:
  - [ADR-002 Class A/B Event Classification and Delivery Boundary](../adr/ADR-002-class-ab-event-classification-and-delivery-boundary.md)
  - [LIN-601 Redpanda Event Stream Baseline](../../database/contracts/lin601_redpanda_event_stream_baseline.md)
  - [Realtime NATS Core Subject and Subscription Runbook (v0)](./realtime-nats-core-subject-subscription-runbook.md)
  - [Redpanda Topic Retention and Replay Operations Runbook](./redpanda-topic-retention-replay-runbook.md)
  - [Workload Identity Secret Manager Standard Operations Runbook](./workload-identity-secret-manager-standard-operations-runbook.md)
  - `LIN-971`

## 1. Purpose and scope

This runbook defines the standard path operating baseline for connecting LinkLynx workloads to
Redpanda Cloud and Synadia Cloud.

In scope:

- staging / prod environment split
- Secret Manager inventory and accessor IAM for approved workloads
- Redpanda / NATS smoke contract
- credential rotation baseline
- provider vs LinkLynx responsibility split
- first-response incident triage
- self-managed fallback boundary

Out of scope:

- provider account / cluster creation automation
- actual runtime producer / consumer implementation
- self-managed Redpanda or NATS deployment
- full provider metrics ingestion into the observability stack

## 2. Hosting baseline

- `Redpanda Cloud` is the managed extension stream path for v1 event operations.
- `Synadia Cloud` is the managed NATS path for realtime fanout and related messaging.
- `staging` and `prod` do not share provider environments or credentials.
- default runtime accessor is `api` only unless Terraform input explicitly expands it.
- all connection material stays in Secret Manager and is accessed via Workload Identity backed GSAs.

Redpanda posture:

- authentication mode: `SASL + TLS`
- smoke topic: `llx.<env>.v1.derived.ops.messaging_smoke.v1`

NATS posture:

- authentication mode: `.creds + TLS`
- smoke subject: `v0.ops.messaging_smoke`

## 3. Secret inventory baseline

### 3.1 Redpanda Cloud

| Secret role | Expected content |
| --- | --- |
| `bootstrap_servers` | comma-separated bootstrap servers |
| `sasl_username` | SASL username |
| `sasl_password` | SASL password |
| `ca_bundle` | PEM bundle used by the Kafka-compatible client |

### 3.2 Synadia Cloud / NATS

| Secret role | Expected content |
| --- | --- |
| `url` | NATS server URL |
| `creds` | raw `.creds` content |
| `ca_bundle` | PEM bundle used by the NATS client when provider guidance requires explicit CA input |

## 4. Rotation baseline

When rotating credentials:

1. retrieve the next provider credential set
2. add new Secret Manager versions first; do not overwrite the previous version in place
3. verify the intended runtime GSAs still hold `roles/secretmanager.secretAccessor`
4. run staging smoke on the Redpanda smoke topic and NATS smoke subject
5. promote the same rotation to `prod`
6. revoke the previous provider credential only after runtime verification closes

Keep the previous secret version available until the new credential has passed smoke and basic
runtime verification.

## 5. Network and connectivity baseline

Terraform owns:

- secret object inventory
- secret accessor IAM for approved runtime workloads
- smoke topic / smoke subject contract

Terraform does not own:

- provider account or cluster bootstrap
- provider-side IP allowlist / private connectivity objects
- provider-side topic provisioning outside the documented smoke path

Before calling the environment production ready, record one of the following for each provider:

- provider-side allowlist evidence
- private connectivity evidence
- explicit risk acceptance for temporary public egress

## 6. Responsibility split

| Area | Provider | LinkLynx |
| --- | --- | --- |
| Managed control plane availability | owns | monitors and escalates |
| Broker/account lifecycle in provider portal | hosts | requests changes and records intent |
| Topic / subject naming contract | no | owns via LIN-601 and ADR-002 runbooks |
| Credential storage and accessor IAM | no | owns via Secret Manager + Workload Identity |
| Core write-path continuity on messaging outage | no | owns |
| Replay / rebuild decision after Redpanda delay | no | owns |
| Reconnect / resubscribe behavior on NATS outage | no | owns |

## 7. Smoke test baseline

### 7.1 Redpanda smoke

Use a provider-approved Kafka-compatible client with the latest secret versions and publish one
record to the environment smoke topic.

Required checks:

1. a dedicated smoke producer authenticates with `bootstrap_servers`, `sasl_username`,
   `sasl_password`, and `ca_bundle`
2. a dedicated smoke consumer group (`smoke.<env>.<timestamp>`) can read the same record
3. the smoke topic name follows LIN-601 naming rules and stays separate from serving consumer groups

### 7.2 NATS smoke

Use the `nats` CLI or an equivalent provider-approved client with the latest `url`, `creds`, and
`ca_bundle`.

Required checks:

1. subscribe to `v0.ops.messaging_smoke`
2. publish one message to the same subject
3. confirm the subscriber receives exactly one payload and exits cleanly

The standard path baseline is considered operationally ready only after both smoke paths succeed in
`staging`.

## 8. Incident triage baseline

### 8.1 Redpanda degradation

- symptoms: produce failures, fetch failures, consumer lag growth, provider partition health alerts
- immediate posture: keep core write path running and treat Redpanda as an extension path only
- next action: verify retention coverage and use the replay runbook if consumer catch-up is needed

### 8.2 NATS degradation

- symptoms: auth failures, reconnect storms, publish failures, missing fanout
- immediate posture: degrade realtime and preserve ADR-002 compensation behavior
- next action: verify canonical subject usage, subscription lifecycle, and provider status

### 8.3 Credential incident

- symptoms: failures begin immediately after secret rotation or client rollout
- immediate posture: roll back to the previous secret version
- next action: identify which runtime workload has adopted the bad credential and isolate rollout scope

## 9. Self-managed fallback boundary

Do not mix self-managed Redpanda or NATS provisioning into this issue.

Open a separate issue when one of the following becomes true:

- provider cost or control surface is no longer acceptable
- required network posture cannot be met
- replay / outage handling needs exceed provider capabilities
- the team decides to host Redpanda or NATS on GCE or future GKE Standard

The fallback must preserve:

- ADR-002 outage behavior
- LIN-601 topic naming / retention / replay boundary
- environment split between `staging` and `prod`
- Secret Manager / Workload Identity based credential boundary
