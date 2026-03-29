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

output "environment" {
  value = local.environment
}

output "project_id" {
  value = var.project_id
}

output "network_foundation" {
  value = module.network_foundation
}

output "gke_low_budget_strategy" {
  value = {
    cluster_enabled = false
    reason          = "LIN-1014 keeps staging on local / preview / temporary environments to stay within the initial 10k JPY budget."
  }
}
