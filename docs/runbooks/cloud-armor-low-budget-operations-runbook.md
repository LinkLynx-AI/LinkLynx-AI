# Cloud Armor Low-Budget Operations Runbook

- Status: Draft
- Last updated: 2026-03-29
- Owner scope: low-budget `prod-only` security baseline
- References:
  - `docs/runbooks/edge-rest-ws-routing-drain-runbook.md`
  - `docs/runbooks/workload-identity-secret-manager-operations-runbook.md`
  - `LIN-1019`

## 1. Purpose and scope

This runbook defines the minimal security baseline for the low-budget `prod-only` path.

In scope:

- Cloud Armor backend security policy attachment for `rust-api-smoke`
- Baseline preconfigured WAF rules with low false-positive sensitivity
- Verification path for `Trivy` image scan and Secret Manager audit logs

Out of scope:

- DAST / bot management / VPC-SC / IAP
- Per-endpoint custom WAF tuning
- Standard-path full security program

## 2. Baseline

- Cloud Armor policy is attached through `GCPBackendPolicy`
- Baseline managed WAF rules:
  - `sqli-v33-stable` with `sensitivity = 1`
  - `xss-v33-stable` with `sensitivity = 1`
- CI image scan remains `Trivy` with `HIGH` / `CRITICAL` fail-fast
- Secret access verification continues to use `secretmanager.googleapis.com` audit logs

## 3. Verify after apply

1. Confirm the backend policy exists:
   - `kubectl -n rust-api-smoke get gcpbackendpolicy`
2. Confirm the backend policy targets the smoke Service:
   - `kubectl -n rust-api-smoke describe gcpbackendpolicy rust-api-smoke-backend-policy`
3. Confirm the referenced Cloud Armor policy name matches Terraform output.
4. Confirm the CD workflow still contains the `Trivy` scan step for published images.
5. Confirm Secret Manager access is visible with the filter from `workload-identity-secret-manager-operations-runbook.md`.

## 4. Triage flow

1. If legitimate requests are blocked, confirm whether the block came from SQLi or XSS baseline rules.
2. Check whether the request pattern changed because of a deploy, client update, or gateway config change.
3. If the issue is clearly a false positive, prefer a Terraform rollback over console-only edits so drift does not accumulate.

## 5. Rollback

1. Set `enable_minimal_security_baseline = false` and re-apply to detach `GCPBackendPolicy`.
2. If attach must remain but a managed rule is noisy, revert the offending WAF rule in Terraform and re-apply.
3. Re-run smoke checks on `/health` and `/ws` after rollback.

## 6. Notes

- This baseline intentionally starts narrow to avoid high false-positive noise.
- Standard-path security hardening remains in `LIN-973`.
