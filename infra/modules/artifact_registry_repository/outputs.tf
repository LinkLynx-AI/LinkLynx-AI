output "repository_id" {
  description = "Artifact Registry repository ID."
  value       = google_artifact_registry_repository.this.repository_id
}

output "repository_name" {
  description = "Full Artifact Registry repository resource name."
  value       = google_artifact_registry_repository.this.name
}

output "repository_url" {
  description = "Base Docker repository URL."
  value       = "${var.location}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.this.repository_id}"
}

output "service_image_names" {
  description = "Base image names keyed by service."
  value = {
    for service_name in var.service_names :
    service_name => "${var.location}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.this.repository_id}/${service_name}"
  }
}
