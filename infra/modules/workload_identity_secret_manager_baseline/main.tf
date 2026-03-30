locals {
  google_service_account_display_name = var.google_service_account_display_name != "" ? var.google_service_account_display_name : "Runtime GSA for ${var.workload_name} (${var.environment})"
  workload_identity_member            = "serviceAccount:${var.project_id}.svc.id.goog[${var.kubernetes_namespace}/${var.kubernetes_service_account_name}]"
  secret_labels = merge(
    {
      environment = var.environment
      managed_by  = "terraform"
      workload    = var.workload_name
    },
    var.labels,
  )
}

resource "google_service_account" "this" {
  account_id   = var.google_service_account_account_id
  display_name = local.google_service_account_display_name
}

resource "google_service_account_iam_member" "workload_identity_user" {
  service_account_id = google_service_account.this.name
  role               = "roles/iam.workloadIdentityUser"
  member             = local.workload_identity_member
}

resource "google_secret_manager_secret" "this" {
  for_each = var.secret_ids

  secret_id = each.value
  labels    = local.secret_labels

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_iam_member" "secret_accessor" {
  for_each = google_secret_manager_secret.this

  secret_id = each.value.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.this.email}"
}
