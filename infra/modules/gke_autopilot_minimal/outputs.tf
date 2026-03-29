output "cluster_name" {
  value = google_container_cluster.this.name
}

output "cluster_location" {
  value = google_container_cluster.this.location
}

output "cluster_endpoint" {
  value = google_container_cluster.this.endpoint
}

output "node_service_account_email" {
  value = google_service_account.node.email
}

output "workload_identity_pool" {
  value = "${var.project_id}.svc.id.goog"
}

output "recommended_namespaces" {
  value = var.recommended_namespaces
}

output "low_budget_request_baseline" {
  value = {
    cpu               = var.fixed_request_cpu
    ephemeral_storage = var.fixed_request_ephemeral_storage
    memory            = var.fixed_request_memory
  }
}

output "upgrade_conditions" {
  value = {
    add_staging_cluster_when = "Preview or staging validation can no longer be covered by local and temporary environments."
    move_to_standard_lin964  = "Next.js or Python become always-on production workloads, or team needs separate staging/prod release cadence."
    switch_to_hpa_when       = "Measured CPU, memory, or concurrency patterns show stable autoscaling signals."
  }
}
