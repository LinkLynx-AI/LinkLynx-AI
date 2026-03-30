locals {
  workload_identity_member = "principalSet://iam.googleapis.com/projects/${var.bootstrap_project_number}/locations/global/workloadIdentityPools/${google_iam_workload_identity_pool.github_actions.workload_identity_pool_id}/attribute.repository/${var.github_repository}"
}

resource "google_iam_workload_identity_pool" "github_actions" {
  project                   = var.bootstrap_project_id
  workload_identity_pool_id = var.workload_identity_pool_id
  display_name              = "GitHub Actions"
  description               = "GitHub OIDC identities for Artifact Registry publishing."
}

resource "google_iam_workload_identity_pool_provider" "github_actions" {
  project                            = var.bootstrap_project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github_actions.workload_identity_pool_id
  workload_identity_pool_provider_id = var.workload_identity_provider_id
  display_name                       = "GitHub Actions provider"
  description                        = "OIDC provider for the LinkLynx-AI GitHub repository."
  attribute_condition                = "assertion.repository_owner == '${var.github_repository_owner}' && assertion.repository == '${var.github_repository}'"
  attribute_mapping = {
    "google.subject"             = "assertion.sub"
    "attribute.actor"            = "assertion.actor"
    "attribute.ref"              = "assertion.ref"
    "attribute.repository"       = "assertion.repository"
    "attribute.repository_owner" = "assertion.repository_owner"
    "attribute.workflow_ref"     = "assertion.workflow_ref"
  }

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_service_account" "artifact_publisher" {
  for_each = var.environment_project_ids

  account_id   = "${var.publisher_service_account_id_prefix}-${each.key}"
  display_name = "GitHub artifact publisher (${each.key})"
  description  = "Publishes container images from GitHub Actions into the ${each.key} Artifact Registry repository."
  project      = var.bootstrap_project_id
}

resource "google_service_account_iam_member" "artifact_publisher_workload_identity_user" {
  for_each = google_service_account.artifact_publisher

  service_account_id = each.value.name
  role               = "roles/iam.workloadIdentityUser"
  member             = local.workload_identity_member
}

resource "google_service_account_iam_member" "artifact_publisher_self_token_creator" {
  for_each = google_service_account.artifact_publisher

  service_account_id = each.value.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:${each.value.email}"
}

resource "google_project_iam_member" "artifact_publisher_writer" {
  for_each = var.environment_project_ids

  project = each.value
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.artifact_publisher[each.key].email}"
}
