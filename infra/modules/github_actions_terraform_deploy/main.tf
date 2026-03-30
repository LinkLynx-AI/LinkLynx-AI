locals {
  workload_identity_member = "principalSet://iam.googleapis.com/projects/${var.bootstrap_project_number}/locations/global/workloadIdentityPools/${var.workload_identity_pool_id}/attribute.repository/${var.github_repository}"
}

resource "google_service_account" "terraform_deployer" {
  for_each = var.environment_names

  account_id   = "${var.deployer_service_account_id_prefix}-${each.key}"
  display_name = "GitHub terraform deployer (${each.key})"
  description  = "Runs Terraform plan/apply from GitHub Actions for the ${each.key} environment."
  project      = var.bootstrap_project_id
}

resource "google_service_account_iam_member" "terraform_deployer_workload_identity_user" {
  for_each = google_service_account.terraform_deployer

  service_account_id = each.value.name
  role               = "roles/iam.workloadIdentityUser"
  member             = local.workload_identity_member
}

resource "google_service_account_iam_member" "terraform_deployer_self_token_creator" {
  for_each = google_service_account.terraform_deployer

  service_account_id = each.value.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:${each.value.email}"
}

resource "google_service_account_iam_member" "terraform_admin_token_creator" {
  for_each = google_service_account.terraform_deployer

  service_account_id = var.terraform_admin_service_account_name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:${each.value.email}"
}

resource "google_storage_bucket_iam_member" "terraform_deployer_state_bucket_admin" {
  for_each = google_service_account.terraform_deployer

  bucket = var.state_bucket_name
  role   = "roles/storage.admin"
  member = "serviceAccount:${each.value.email}"
}
