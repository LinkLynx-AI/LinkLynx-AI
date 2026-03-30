locals {
  base_name                         = "linklynx-${var.environment}"
  cluster_name                      = var.cluster_name != "" ? var.cluster_name : "${local.base_name}-autopilot-standard"
  node_service_account_display_name = "GKE Autopilot standard node service account (${var.environment})"

  labels = merge(
    {
      cost_profile = "standard"
      environment  = var.environment
      issue        = "lin-964"
      managed_by   = "terraform"
    },
    var.labels,
  )
}

resource "google_service_account" "node" {
  account_id   = var.node_service_account_account_id
  display_name = local.node_service_account_display_name
}

resource "google_project_iam_member" "node_default" {
  project = var.project_id
  role    = "roles/container.defaultNodeServiceAccount"
  member  = "serviceAccount:${google_service_account.node.email}"
}

resource "google_project_iam_member" "node_artifact_registry_reader" {
  project = var.project_id
  role    = "roles/artifactregistry.reader"
  member  = "serviceAccount:${google_service_account.node.email}"
}

resource "google_container_cluster" "this" {
  name     = local.cluster_name
  location = var.region

  enable_autopilot    = true
  deletion_protection = var.deletion_protection
  network             = var.network_self_link
  subnetwork          = var.subnetwork_self_link
  resource_labels     = local.labels

  ip_allocation_policy {
    cluster_secondary_range_name  = var.pods_secondary_range_name
    services_secondary_range_name = var.services_secondary_range_name
  }

  cluster_autoscaling {
    auto_provisioning_defaults {
      service_account = google_service_account.node.email
    }
  }

  release_channel {
    channel = var.release_channel
  }

  depends_on = [
    google_project_iam_member.node_default,
    google_project_iam_member.node_artifact_registry_reader,
  ]
}
