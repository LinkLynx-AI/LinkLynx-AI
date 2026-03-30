# Security Standard Operations Runbook

- Status: Draft
- Last updated: 2026-03-30
- Owner scope: standard path `staging` / `prod` security baseline
- References:
  - [ADR-004 AuthZ Fail-Close Policy and Cache Strategy](../adr/ADR-004-authz-fail-close-and-cache-strategy.md)
  - [ADR-005 Dragonfly Outage RateLimit Failure Policy (Hybrid)](../adr/ADR-005-dragonfly-ratelimit-failure-policy.md)
  - [GKE Autopilot Standard Operations Runbook](./gke-autopilot-standard-operations-runbook.md)
  - [Workload Identity + Secret Manager Standard Operations Runbook](./workload-identity-secret-manager-standard-operations-runbook.md)
  - [Argocd Rollouts Standard Operations Runbook](./argocd-rollouts-standard-operations-runbook.md)
  - [Observability Standard Operations Runbook](./observability-standard-operations-runbook.md)
  - `LIN-973`

## 1. Purpose and scope

This runbook defines the standard path security baseline for LinkLynx infrastructure.

In scope:

- edge WAF / DDoS baseline on the standard GKE ingress path
- PR-time security scan baseline for repo secret / dependency / IaC / application
- image scan baseline for changed service images and publish gate
- manual DAST baseline workflow
- cluster / IAM / secret audit posture
- fail-close vs manual-relief boundary

Out of scope:

- private control plane or `master_authorized_networks` re-architecture
- full browser-authenticated DAST against the production application
- VPC-SC / IAP / bot management / full compliance controls
- runtime AuthN/AuthZ redesign

## 2. Adopted baseline

### 2.1 Edge

- `LIN-963` creates the shared `Cloud Armor` policy:
  - `linklynx-staging-edge-baseline`
  - `linklynx-prod-edge-baseline`
- `LIN-973` attaches that policy to the standard GitOps canary smoke Services through `GCPBackendPolicy`
- managed WAF rules remain:
  - `sqli-v33-stable` with `sensitivity = 1`
  - `xss-v33-stable` with `sensitivity = 1`
- volumetric DDoS handling stays on the Google edge / external Application Load Balancer baseline; no custom rate-limit rule is added in this issue

### 2.2 CI / pipeline

- repo secret scan: `Gitleaks`
- dependency review: `actions/dependency-review-action`
- IaC misconfiguration scan: `Trivy config` against `infra/`
- application SAST: `Semgrep` on changed `rust` / `typescript` / `python` source files only
- image vulnerability scan:
  - PR path: changed service images are built locally and scanned with `Trivy image`
  - publish path: `LIN-966` keeps `Trivy` on pushed Artifact Registry digests
- DAST:
  - manual GitHub Actions workflow `Security DAST Baseline`
  - target is the local `docker compose` rust smoke service
  - this is advisory/manual, not a merge-blocking gate

### 2.3 Audit / change management

- `secretmanager.googleapis.com`
  - `ADMIN_READ`
  - `DATA_READ`
- `iam.googleapis.com`
  - `ADMIN_READ`
  - `DATA_READ`
- Admin Activity logs for GKE / IAM / Load Balancer changes remain on by default and are part of the audit trail
- configuration changes must flow through:
  - Terraform PR for infra resources
  - GitOps PR for in-cluster manifests
  - Argo CD sync history for standard applications
- console-only hotfixes are emergency-only and must be reconciled back into Git immediately

## 3. Verify

### 3.1 Edge / WAF

1. Render the standard GitOps apps:

   ```bash
   make infra-gitops-validate
   ```

2. After apply / sync, confirm the backend policy exists:

   ```bash
   kubectl -n api get gcpbackendpolicy
   kubectl -n api describe gcpbackendpolicy canary-smoke-stable-backend-policy
   kubectl -n api describe gcpbackendpolicy canary-smoke-canary-backend-policy
   ```

3. Confirm the referenced policy name matches the Terraform environment:
   - `linklynx-staging-edge-baseline`
   - `linklynx-prod-edge-baseline`

### 3.2 Audit posture

1. Confirm audit configs exist:

   ```bash
   gcloud projects get-iam-policy <project-id> \
     --flatten="auditConfigs[]" \
     --format="table(auditConfigs.service,auditConfigs.auditLogConfigs.logType)"
   ```

2. Secret access filter:

   ```text
   resource.type="audited_resource"
   protoPayload.serviceName="secretmanager.googleapis.com"
   ```

3. IAM read/change filter:

   ```text
   resource.type="audited_resource"
   protoPayload.serviceName="iam.googleapis.com"
   ```

### 3.3 CI / DAST

1. Confirm PR CI contains:
   - `Repo Secret Scan`
   - `Dependency Review`
   - `Infra Config Scan`
   - `Application SAST`
   - `Image Security Scan`
2. Confirm publish pipeline still scans pushed digests with `Trivy`
3. Trigger `Security DAST Baseline` manually and inspect the uploaded `zap-report.*` artifacts

## 4. Fail-close vs manual-relief boundary

- AuthZ is fail-close and follows ADR-004.
  - deterministic deny: `403` / WS `1008`
  - indeterminate authz dependency failure: `503` / WS `1011`
- secret access is fail-close.
  - no baked-in fallback credential
  - no local file or stale secret fallback
- PR security gates are fail-close.
  - repo secret / dependency / IaC / Semgrep / changed-image scan failures block merge until fixed or explicitly narrowed
- DAST is manual/advisory for this baseline.
  - it produces evidence and a report
  - it does not auto-block merge until a stable authenticated target exists
- `Cloud Armor` false positives are handled by staged rollback or Terraform rule adjustment, not by an automatic fail-open path
- Dragonfly rate-limit behavior keeps the ADR-005 hybrid rule:
  - high-risk abuse surfaces: fail-close
  - continuity-sensitive reads / writes: degraded fail-open

## 5. Rollback

1. If `Cloud Armor` blocks legitimate traffic, revert the `GCPBackendPolicy` manifest or narrow the WAF rule in Terraform after staging verification.
2. If a CI security job is too noisy, first narrow the target to changed files or service-specific scope; do not disable the whole security workflow by default.
3. If IAM / secret audit config causes unexpected noise or cost, remove the new audit config resource via Terraform instead of editing in console.
4. If manual DAST becomes unusable, keep the workflow file but narrow the target or scan time so the operator path stays documented.

## 6. Known boundary

- The standard path still relies on public control-plane reachability for Terraform / Helm / GitHub Actions driven operations.
- Because of that, `master_authorized_networks` and private control plane hardening remain a dedicated follow-up.
- This runbook records the exception so that the `.trivyignore` entry for `AVD-GCP-0061` stays explicit and reviewable.
