output "cluster_name" {
  value = google_container_cluster.this.name
}

output "cluster_location" {
  value = google_container_cluster.this.location
}

output "cluster_endpoint" {
  value = google_container_cluster.this.endpoint
}

output "cluster_ca_certificate" {
  value = google_container_cluster.this.master_auth[0].cluster_ca_certificate
}

output "node_service_account_email" {
  value = google_service_account.node.email
}

output "workload_identity_pool" {
  value = "${var.project_id}.svc.id.goog"
}
