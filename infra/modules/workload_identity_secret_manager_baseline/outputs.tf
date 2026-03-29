output "google_service_account_email" {
  value = google_service_account.this.email
}

output "kubernetes_service_account_annotations" {
  value = {
    "iam.gke.io/gcp-service-account" = google_service_account.this.email
  }
}

output "managed_kubernetes_service_account" {
  value = var.manage_kubernetes_service_account ? {
    name      = kubernetes_service_account_v1.this[0].metadata[0].name
    namespace = kubernetes_service_account_v1.this[0].metadata[0].namespace
  } : null
}

output "workload_identity_member" {
  value = "serviceAccount:${var.project_id}.svc.id.goog[${var.kubernetes_namespace}/${var.kubernetes_service_account_name}]"
}

output "secret_ids" {
  value = sort(keys(google_secret_manager_secret.this))
}

output "secret_resource_ids" {
  value = {
    for secret_id, secret in google_secret_manager_secret.this : secret_id => secret.id
  }
}
