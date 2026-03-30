# CI Security Low-Budget Operations Runbook

- Status: Draft
- Last updated: 2026-03-29
- Owner scope: low-budget `prod-only` CI security scan baseline
- References:
  - `docs/runbooks/cloud-armor-low-budget-operations-runbook.md`
  - `docs/runbooks/workload-identity-secret-manager-operations-runbook.md`
  - `LIN-1019`
  - `LIN-1030`

## 1. Purpose and scope

This runbook defines the low-budget `prod-only` CI security scan baseline that runs before merge.

In scope:

- repo secret scan with `Gitleaks`
- Terraform misconfiguration scan for `infra/` with `Trivy config`
- accepted temporary ignore for the low-budget GKE public control plane
- local reproduction and rollback guidance

Out of scope:

- DAST / browser-driven scanner automation
- CodeQL or GitHub Advanced Security specific features
- runtime policy enforcement inside the cluster
- container image scan changes already covered by `LIN-966`

## 2. Baseline

- CI job `Repo Secret Scan` runs `Gitleaks` against the working tree
- CI job `Infra Config Scan` runs `Trivy config` against `infra/`
- both jobs are fail-fast on pull requests to `main`
- `.gitleaks.toml` suppresses local build output directories and `.gitleaksignore` suppresses only 2 deterministic test fixtures
- `.trivyignore` suppresses `AVD-GCP-0061` for the current low-budget Autopilot control plane exposure

## 3. Why `AVD-GCP-0061` is temporarily ignored

`Trivy` flags the low-budget Autopilot cluster because `master_authorized_networks` is not enabled.

That finding is real, but this path currently relies on GitHub-hosted runners reaching the public control
plane during Terraform-driven deploys. Tightening that immediately would require a separate change in cluster
access strategy, not just a scanner toggle.

For the low-budget path we accept this temporarily and track the hardening work in the standard-path cluster /
security backlog. The ignore must stay narrow and documented; it is not a general exemption for future clusters.

## 4. Local reproduction

1. Run the repo secret scan:

   ```bash
   temp_repo="$(mktemp -d)"
   trap 'rm -rf "${temp_repo}"' EXIT
   git ls-files -z | rsync -a --files-from=- --from0 ./ "${temp_repo}/"

   docker run --rm \
     -v "${temp_repo}:/repo" \
     -v "${PWD}/.gitleaks.toml:/config/.gitleaks.toml:ro" \
     -v "${PWD}/.gitleaksignore:/config/.gitleaksignore:ro" \
     ghcr.io/gitleaks/gitleaks:v8.24.2 \
     detect \
     --no-git \
     --source /repo \
     --config /config/.gitleaks.toml \
     --gitleaks-ignore-path /config/.gitleaksignore \
     --redact \
     --exit-code 1 \
     --no-banner \
     --no-color \
     --max-target-megabytes 5
   ```

2. Run the infra config scan:

   ```bash
   docker run --rm \
     -v "${PWD}:/src" \
     -w /src \
     aquasec/trivy:0.63.0 \
     config \
     --severity HIGH,CRITICAL \
     --exit-code 1 \
     --ignorefile .trivyignore \
     infra
   ```

## 5. Triage flow

1. If `Gitleaks` fails, first confirm whether the finding is a real secret or a deterministic test fixture.
2. Prefer removing or rotating the secret over adding a new allowlist entry.
3. If the finding is a stable test-only artifact, scope the allowlist as narrowly as possible by file path and pattern.
4. Fingerprint-based ignores in `.gitleaksignore` should stay exceptional and deterministic.
5. If `Trivy` fails, determine whether the finding is a real infrastructure risk or an accepted temporary tradeoff.
6. Accepted temporary tradeoffs must be documented with the reason and the issue that owns the future hardening work.

## 6. Rollback

1. If a newly added scan is too noisy, revert the scanner change or narrow its target path in Terraform / CI config.
2. Do not disable the whole CI workflow unless the scanner itself is broken.
3. If an ignore entry is no longer needed, remove it first and re-run the scanner locally before merging.

## 7. Notes

- This baseline intentionally covers only `repo secret` and `infra misconfig` checks to keep the low-budget path quiet.
- Full security expansion remains in `LIN-973`.
