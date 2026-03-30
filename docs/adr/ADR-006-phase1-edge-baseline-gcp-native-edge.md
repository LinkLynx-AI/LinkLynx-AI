# ADR-006 Phase 1 Edge Baseline on GCP Native Edge

- Status: Accepted
- Date: 2026-03-27
- Related:
  - [LIN-960](https://linear.app/linklynx-ai/issue/LIN-960/インフラ基盤-phase-0-2-実行計画)
  - [LIN-961](https://linear.app/linklynx-ai/issue/LIN-961/01-edge-戦略-adr-を確定する)
  - [LIN-963](https://linear.app/linklynx-ai/issue/LIN-963/03-vpc-サブネット-ingress-dns-tls-基盤を-terraform-化する)
  - [LIN-973](https://linear.app/linklynx-ai/issue/LIN-973/13-セキュリティ統制-baseline-を整備する)
  - [Edge REST/WS Routing and WS Drain Runbook](../runbooks/edge-rest-ws-routing-drain-runbook.md)

## Context

Phase 1 baseline was re-evaluated under the following constraints:

- single cloud is acceptable for now
- future migration to physical servers remains possible
- current priority is operational simplicity over premature multi-cloud design
- portability must still be preserved through IaC, Kubernetes, and standard protocols

The accepted Phase 1 runtime baseline is:

- `GCP / us-east1`
- `staging + prod`
- one GKE cluster per environment
- applications run on Kubernetes
- databases and messaging prioritize operational ease for now

LIN-961 must fix one edge baseline before VPC / DNS / TLS / ingress work proceeds.
Without one decision, infrastructure documents can diverge between:

1. `Cloudflare front door -> GCLB -> GKE`
2. `GCP native edge -> GKE`

## Scope

In scope:

- public DNS ownership
- public TLS certificate ownership
- WAF / DDoS protection point for Phase 1
- L7 routing and health-check ownership
- CDN usage boundary for Phase 1
- REST / WebSocket edge traffic path
- rollback boundary for edge configuration incidents

Out of scope:

- multi-region or multi-cloud DR implementation
- future physical-server front door design
- service mesh or internal east-west traffic policy
- application runtime or database implementation details

## Decision

### 1. Phase 1 adopts GCP native edge

The Phase 1 edge baseline is fixed as:

- `Cloud DNS` for authoritative public DNS
- `Certificate Manager` for public TLS certificate management
- `GCP External Application Load Balancer (GCLB)` for L7 routing, TLS termination, WebSocket upgrade support, and backend health checks
- `Cloud Armor` for WAF and edge protection policy
- `Cloud CDN` only for static asset delivery when explicitly enabled

`Cloudflare front door` is not part of the Phase 1 runtime baseline.

### 2. Fixed traffic paths

#### 2.1 REST

`client -> Cloud DNS -> GCLB (+ Cloud Armor, optional Cloud CDN for static assets) -> GKE Ingress -> backend service`

#### 2.2 WebSocket

`client -> Cloud DNS -> GCLB (+ Cloud Armor) -> GKE Ingress -> API /ws`

Rules:

- WebSocket routes must not use CDN caching.
- API routes must not use CDN caching by default.
- CDN enablement is limited to static assets and other explicitly cacheable routes.

### 3. Responsibility boundaries

| boundary | owner | responsibility |
| --- | --- | --- |
| Public DNS | Cloud DNS | Hostname ownership and resolution to the active GCLB frontend |
| Public TLS | Certificate Manager + GCLB | Certificate issuance/attachment and HTTPS termination |
| Edge protection | Cloud Armor | WAF policy and edge request filtering |
| L7 routing / health | GCLB | Host/path routing, backend health judgment, new connection distribution |
| App ingress | GKE Ingress | Route mapping from LB to Kubernetes services |
| App health / WS lifecycle | API | `GET /health`, `GET /ws`, heartbeat, reconnect, and drain semantics |

### 4. Rollback baseline

Rollback authority stays inside GCP for Phase 1.
The rollback order is:

1. revert the last validated GCLB / Ingress routing change
2. revert Certificate Manager attachment or target-proxy change if TLS is impacted
3. revert Cloud DNS record only when frontend endpoint selection changed
4. pause rollout and restore the last validated backend revision if routing is healthy but the release is not

Operational rule:

- prefer rollback of LB / ingress / release configuration before DNS changes
- DNS rollback is a last resort because propagation delay is larger and operationally noisier

### 5. Why Cloudflare is not selected now

Cloudflare remains a viable future option, but is not adopted in Phase 1 because:

- it adds a second edge control plane while the accepted Phase 1 model is single-cloud
- the current goal is operational simplicity for `staging + prod`, not front-door portability at any cost
- Kubernetes, Terraform, and standard protocols already preserve the main portability requirement for applications and data paths

Future trigger to reconsider Cloudflare or another external front door:

- multi-cloud DR becomes an execution requirement
- physical-server migration enters active planning
- GCP edge capabilities no longer satisfy the product or operations needs

## How to test

1. DNS:
   - confirm public hosts resolve to the active GCLB frontend
2. TLS:
   - confirm the certificate is active and attached to the intended target proxy
3. Routing:
   - confirm REST and WS routes reach the expected backend through GKE Ingress
4. Health:
   - confirm `GET /health` is the authoritative backend health-check endpoint
5. CDN boundary:
   - confirm API / WS routes are not cached
6. Rollback:
   - confirm a staging routing change can be reverted without DNS change in the normal case

## ADR-001 compatibility checklist result

Result: PASS / N.A. (no event schema change introduced by this ADR)

- Additive-only schema rule: N.A.
- Consumer impact: no runtime payload contract change
- Monitoring and rollback readiness: covered by fixed traffic path and rollback baseline
- Documentation scope: ADR, decisions summary, and edge runbook are updated together

## Consequences

- LIN-963 can proceed with one unambiguous DNS / TLS / LB baseline
- LIN-973 can build WAF / edge protection policy on one fixed owner boundary
- Phase 1 stays operationally simpler than the Cloudflare-front-door option
- portability is preserved mainly through Kubernetes, Terraform, and protocol choices rather than a portable edge layer
