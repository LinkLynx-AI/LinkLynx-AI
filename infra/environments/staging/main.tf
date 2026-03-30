locals {
  environment = "staging"
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
