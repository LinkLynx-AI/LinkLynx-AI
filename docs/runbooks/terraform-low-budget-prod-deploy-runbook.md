# Terraform Low-budget Prod Deploy Runbook

- Owner scope: low-budget `prod-only` deploy baseline
- Related:
  - `docs/runbooks/edge-rest-ws-routing-drain-runbook.md`
  - `docs/runbooks/workload-identity-secret-manager-operations-runbook.md`
  - `docs/runbooks/cloud-monitoring-low-budget-operations-runbook.md`
  - `docs/runbooks/cloud-armor-low-budget-operations-runbook.md`
- Source issues:
  - `LIN-1021`

## 1. Purpose

This runbook defines the initial deploy and rollback flow for the low-budget `prod-only` path.

This path intentionally does **not** introduce `Argo CD` or `Argo Rollouts` yet.
Instead it uses:

- GitHub Actions `workflow_dispatch`
- Workload Identity Federation
- a dedicated GitHub Terraform deployer service account
- `terraform-admin` service account impersonation
- GitHub `prod` environment approval before apply

## 2. Required GitHub settings

### 2.1 Repository variables

- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_TERRAFORM_DEPLOYER_SERVICE_ACCOUNT`
- `GCP_TERRAFORM_ADMIN_SERVICE_ACCOUNT_EMAIL`
- `GCP_TERRAFORM_STATE_BUCKET`
- `GCP_TERRAFORM_STATE_PREFIX_PROD`

`GCP_TERRAFORM_STATE_PREFIX_PROD` defaults to `env/prod` and may be omitted when that prefix is used.

### 2.2 Repository secrets

- `INFRA_PROD_TERRAFORM_TFVARS`

`INFRA_PROD_TERRAFORM_TFVARS` should contain the effective `terraform.tfvars` content for `infra/environments/prod`.
Keep runtime secret values themselves out of this file. Use Secret Manager IDs and other non-secret deploy inputs only.

### 2.3 GitHub environment

- Environment name: `prod`
- Configure required reviewers before first apply

The workflow uses the `prod` environment only on the apply job so that:

- `plan` can run without waiting for human approval
- `apply` is blocked until a human reviewer approves it

## 3. Workflow contract

Workflow file:

- `.github/workflows/infra-deploy-prod.yml`

Inputs:

- `operation`
  - `plan`
  - `apply`
- `rust_api_image_digest`
  - optional override for `rust_api_image_digest`
- `confirm_production_apply`
  - required to be exactly `prod` for apply

## 4. Plan procedure

Use `operation=plan` when you want to preview infra or workload changes.

The workflow will:

1. read Terraform version from `.terraform-version`
2. authenticate to GCP with Workload Identity Federation
3. generate `backend.hcl` from GitHub variables
4. generate `github-actions.auto.tfvars` from `INFRA_PROD_TERRAFORM_TFVARS`
5. optionally append `rust_api_image_digest`
6. run `terraform fmt -check -recursive infra`
7. run `terraform init`
8. run `terraform validate`
9. run `terraform plan`
10. upload `tfplan` and `tfplan.txt`

## 5. Apply procedure

Use `operation=apply` only after reviewing the plan.

Apply guardrails:

- the workflow must run from `main`
- `confirm_production_apply` must be `prod`
- the `prod` GitHub environment approval must pass

The apply job downloads the exact `tfplan` artifact from the plan job and runs:

```bash
terraform apply -input=false tfplan
```

## 6. Rust API smoke deploy update

If the deploy only changes the Rust API image:

1. publish a new image digest from `.github/workflows/cd.yml`
2. run `Infra Deploy (prod)` with:
   - `operation=plan`
   - `rust_api_image_digest=<new digest>`
3. review the plan artifact
4. rerun with:
   - `operation=apply`
   - `rust_api_image_digest=<same digest>`
   - `confirm_production_apply=prod`

## 7. Rollback

### 7.1 Rust API image rollback

1. identify the previous known-good image digest
2. run `Infra Deploy (prod)` with that digest override
3. execute `plan`
4. if the diff is correct, execute `apply`

### 7.2 Infra rollback

If the apply introduced an infra regression:

1. restore the previous `INFRA_PROD_TERRAFORM_TFVARS` contents or revert the infra code on `main`
2. rerun `plan`
3. confirm the rollback diff
4. rerun `apply`

## 8. Failure handling

- `terraform init` fails:
  - verify `GCP_TERRAFORM_STATE_BUCKET`
  - verify `GCP_TERRAFORM_STATE_PREFIX_PROD`
  - verify the deployer service account still has state bucket access
- `terraform plan` fails with auth or permission errors:
  - verify `GCP_TERRAFORM_DEPLOYER_SERVICE_ACCOUNT`
  - verify `GCP_TERRAFORM_ADMIN_SERVICE_ACCOUNT_EMAIL`
  - verify the deployer service account still has `roles/iam.serviceAccountTokenCreator` on `terraform-admin`
- `terraform apply` fails after partial resource changes:
  - inspect the plan text artifact
  - inspect `terraform state` from the same backend
  - use the relevant resource runbook before retrying

## 9. Upgrade trigger

Move from this low-budget deploy path to standard `LIN-967` GitOps when one or more of the following become true:

- `prod-only` manual apply is too slow for safe deploy cadence
- staging promotion becomes mandatory
- multiple long-lived workloads need independent rollout control
- the team needs automated canary analysis instead of manual plan/apply review
