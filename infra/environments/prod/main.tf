locals {
  environment = "prod"
}

module "network_foundation" {
  source = "../../modules/network_foundation"

  environment          = local.environment
  region               = var.region
  public_dns_zone_name = var.public_dns_zone_name
  public_dns_name      = var.public_dns_name
  public_hostnames     = var.public_hostnames
}

module "gke_autopilot_minimal" {
  count = var.enable_minimal_gke_cluster ? 1 : 0

  source = "../../modules/gke_autopilot_minimal"

  environment                   = local.environment
  network_self_link             = module.network_foundation.network_self_link
  pods_secondary_range_name     = module.network_foundation.gke_pods_secondary_range_name
  project_id                    = var.project_id
  region                        = var.region
  services_secondary_range_name = module.network_foundation.gke_services_secondary_range_name
  subnetwork_self_link          = module.network_foundation.gke_nodes_subnet_self_link
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

output "gke_autopilot_minimal" {
  value = var.enable_minimal_gke_cluster ? module.gke_autopilot_minimal[0] : null
}
