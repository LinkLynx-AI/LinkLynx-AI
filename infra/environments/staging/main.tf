locals {
  environment                 = "staging"
  enable_standard_gke_cluster = var.enable_standard_gke_cluster_baseline
}

module "network_foundation" {
  source = "../../modules/network_foundation"

  environment          = local.environment
  region               = var.region
  public_dns_zone_name = var.public_dns_zone_name
  public_dns_name      = var.public_dns_name
  public_hostnames     = var.public_hostnames
}

module "artifact_registry_repository" {
  source = "../../modules/artifact_registry_repository"

  environment   = local.environment
  location      = var.region
  project_id    = var.project_id
  repository_id = var.artifact_registry_repository_id
}

module "gke_autopilot_standard_cluster" {
  count = local.enable_standard_gke_cluster ? 1 : 0

  source = "../../modules/gke_autopilot_standard_cluster"

  environment = local.environment
  labels = {
    environment = local.environment
    issue       = "lin-964"
  }
  network_self_link             = module.network_foundation.network_self_link
  pods_secondary_range_name     = module.network_foundation.gke_pods_secondary_range_name
  project_id                    = var.project_id
  region                        = var.region
  release_channel               = var.standard_gke_release_channel
  services_secondary_range_name = module.network_foundation.gke_services_secondary_range_name
  subnetwork_self_link          = module.network_foundation.gke_nodes_subnet_self_link
}

module "gke_namespace_baseline" {
  count = local.enable_standard_gke_cluster ? 1 : 0

  source = "../../modules/gke_namespace_baseline"

  environment     = local.environment
  namespace_names = var.standard_gke_namespace_names
  labels = {
    environment = local.environment
    issue       = "lin-964"
  }

  depends_on = [module.gke_autopilot_standard_cluster]
}

output "environment" {
  value = local.environment
}

output "project_id" {
  value = var.project_id
}

output "network_foundation" {
  value = module.network_foundation
}

output "artifact_registry_repository" {
  value = module.artifact_registry_repository
}

output "gke_low_budget_strategy" {
  value = {
    cluster_enabled = false
    reason          = "LIN-1014 keeps staging on local / preview / temporary environments to stay within the initial 10k JPY budget."
  }
}

output "gke_autopilot_standard_cluster" {
  value = local.enable_standard_gke_cluster ? module.gke_autopilot_standard_cluster[0] : null
}

output "gke_namespace_baseline" {
  value = local.enable_standard_gke_cluster ? module.gke_namespace_baseline[0] : null
}
