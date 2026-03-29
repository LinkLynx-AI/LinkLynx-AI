locals {
  environment                         = "staging"
  enable_standard_gke_cluster         = var.enable_standard_gke_cluster_baseline
  enable_standard_cloud_sql           = var.enable_standard_cloud_sql_baseline
  enable_standard_gitops              = var.enable_standard_gitops_baseline
  enable_standard_workload_identities = var.enable_standard_workload_identity_baseline
  standard_runtime_identities = {
    frontend = {
      google_service_account_account_id = "frontend-runtime"
      kubernetes_namespace              = "frontend"
      kubernetes_service_account_name   = "frontend-runtime"
      secret_ids                        = lookup(var.standard_runtime_secret_ids, "frontend", [])
      workload_name                     = "frontend-runtime"
    }
    api = {
      google_service_account_account_id = "api-runtime"
      kubernetes_namespace              = "api"
      kubernetes_service_account_name   = "api-runtime"
      secret_ids                        = lookup(var.standard_runtime_secret_ids, "api", [])
      workload_name                     = "api-runtime"
    }
    ai = {
      google_service_account_account_id = "ai-runtime"
      kubernetes_namespace              = "ai"
      kubernetes_service_account_name   = "ai-runtime"
      secret_ids                        = lookup(var.standard_runtime_secret_ids, "ai", [])
      workload_name                     = "ai-runtime"
    }
  }
}

check "standard_workload_identity_prerequisites" {
  assert {
    condition     = !var.enable_standard_workload_identity_baseline || var.enable_standard_gke_cluster_baseline
    error_message = "enable_standard_workload_identity_baseline requires enable_standard_gke_cluster_baseline = true."
  }

  assert {
    condition     = !var.enable_standard_workload_identity_baseline || length(setsubtract(toset(["frontend", "api", "ai"]), var.standard_gke_namespace_names)) == 0
    error_message = "enable_standard_workload_identity_baseline requires frontend, api, and ai namespaces in standard_gke_namespace_names."
  }
}

check "standard_gitops_prerequisites" {
  assert {
    condition     = !var.enable_standard_gitops_baseline || var.enable_standard_gke_cluster_baseline
    error_message = "enable_standard_gitops_baseline requires enable_standard_gke_cluster_baseline = true."
  }

  assert {
    condition     = !var.enable_standard_gitops_baseline || length(setsubtract(toset(["api", "ops"]), var.standard_gke_namespace_names)) == 0
    error_message = "enable_standard_gitops_baseline requires api and ops namespaces in standard_gke_namespace_names."
  }
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

resource "google_project_iam_audit_config" "secret_manager_data_access" {
  count = local.enable_standard_workload_identities ? 1 : 0

  project = var.project_id
  service = "secretmanager.googleapis.com"

  audit_log_config {
    log_type = "ADMIN_READ"
  }

  audit_log_config {
    log_type = "DATA_READ"
  }
}

module "standard_runtime_identities" {
  for_each = local.enable_standard_workload_identities ? local.standard_runtime_identities : {}

  source = "../../modules/workload_identity_secret_manager_baseline"

  environment                       = local.environment
  google_service_account_account_id = each.value.google_service_account_account_id
  kubernetes_namespace              = each.value.kubernetes_namespace
  kubernetes_service_account_name   = each.value.kubernetes_service_account_name
  labels = {
    environment = local.environment
    issue       = "lin-965"
  }
  manage_kubernetes_service_account = true
  project_id                        = var.project_id
  secret_ids                        = toset(each.value.secret_ids)
  workload_name                     = each.value.workload_name

  depends_on = [
    google_project_iam_audit_config.secret_manager_data_access,
    module.gke_namespace_baseline,
  ]
}

module "gitops_standard_baseline" {
  count = local.enable_standard_gitops ? 1 : 0

  source = "../../modules/gitops_standard_baseline"

  app_project_name = "linklynx-platform"
  applications = {
    "staging-canary-smoke" = {
      destination_namespace = "api"
      path                  = "infra/gitops/apps/staging/canary-smoke"
      sync_policy = {
        automated = true
      }
    }
  }
  argocd_chart_version   = var.standard_gitops_argocd_chart_version
  argocd_namespace       = "ops"
  argocd_release_name    = "argocd"
  environment            = local.environment
  gitops_repository_url  = var.standard_gitops_repository_url
  gitops_target_revision = var.standard_gitops_target_revision
  labels = {
    environment = local.environment
    issue       = "lin-967"
  }
  rollouts_chart_version = var.standard_gitops_rollouts_chart_version
  rollouts_release_name  = "argo-rollouts"

  depends_on = [module.gke_namespace_baseline]
}

module "cloud_sql_postgres_standard" {
  count = local.enable_standard_cloud_sql ? 1 : 0

  source = "../../modules/cloud_sql_postgres_standard"

  allocated_ip_range_name = module.network_foundation.private_service_access_range_name
  availability_type       = "ZONAL"
  database_name           = var.standard_cloud_sql_database_name
  disk_size_gb            = var.standard_cloud_sql_disk_size_gb
  environment             = local.environment
  labels = {
    environment = local.environment
    issue       = "lin-968"
  }
  network_self_link = module.network_foundation.network_self_link
  project_id        = var.project_id
  region            = var.region
  retained_backups  = var.standard_cloud_sql_staging_retained_backups
  tier              = var.standard_cloud_sql_tier

  depends_on = [module.network_foundation]
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

output "standard_runtime_identities" {
  value = local.enable_standard_workload_identities ? {
    for workload, identity in module.standard_runtime_identities : workload => {
      google_service_account_email = identity.google_service_account_email
      kubernetes_service_account   = identity.managed_kubernetes_service_account
      secret_ids                   = identity.secret_ids
      workload_identity_member     = identity.workload_identity_member
    }
  } : {}
}

output "standard_gitops_baseline" {
  value = local.enable_standard_gitops ? merge(module.gitops_standard_baseline[0], {
    bootstrap_kustomize_path = "infra/gitops/bootstrap/staging"
  }) : null
}

output "cloud_sql_postgres_standard" {
  value = local.enable_standard_cloud_sql ? module.cloud_sql_postgres_standard[0] : null
}
