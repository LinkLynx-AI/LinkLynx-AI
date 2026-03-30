resource "google_artifact_registry_repository" "this" {
  project       = var.project_id
  location      = var.location
  repository_id = var.repository_id
  description   = "Container images for the ${var.environment} environment."
  format        = "DOCKER"
  labels = merge(var.labels, {
    component   = "artifact-registry"
    environment = var.environment
  })

  docker_config {
    immutable_tags = true
  }
}
