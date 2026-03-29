locals {
  environment                              = "prod"
  enable_standard_gke_cluster              = var.enable_standard_gke_cluster_baseline
  enable_standard_cloud_sql                = var.enable_standard_cloud_sql_baseline
  enable_standard_gitops                   = var.enable_standard_gitops_baseline
  enable_standard_workload_identities      = var.enable_standard_workload_identity_baseline
  normalized_public_hostnames              = [for hostname in var.public_hostnames : trimsuffix(hostname, ".")]
  rust_api_public_hostname                 = var.rust_api_public_hostname != "" ? trimsuffix(var.rust_api_public_hostname, ".") : (length(local.normalized_public_hostnames) > 0 ? local.normalized_public_hostnames[0] : "")
  enable_rust_api_smoke                    = var.enable_rust_api_smoke_deploy && var.enable_minimal_gke_cluster
  rust_api_smoke_inputs_are_set            = var.rust_api_image_digest != "" && local.rust_api_public_hostname != ""
  rust_api_smoke_edge_is_ready             = module.network_foundation.public_certificate_map_name != null && module.network_foundation.public_lb_ipv4_name != ""
  enable_minimal_cloud_sql                 = var.enable_minimal_cloud_sql_baseline
  enable_minimal_monitoring                = var.enable_minimal_monitoring_baseline
  enable_minimal_security                  = var.enable_minimal_security_baseline
  enable_minimal_dragonfly                 = var.enable_minimal_dragonfly_baseline
  enable_minimal_scylla_runtime            = var.enable_minimal_scylla_runtime_baseline
  enable_minimal_managed_messaging_secrets = var.enable_minimal_managed_messaging_secret_baseline
  enable_minimal_search_secrets            = var.enable_minimal_search_secret_baseline
  minimal_scylla_runtime_env = local.enable_minimal_scylla_runtime ? {
    SCYLLA_HOSTS              = join(",", sort(tolist(var.minimal_scylla_hosts)))
    SCYLLA_KEYSPACE           = var.minimal_scylla_keyspace
    SCYLLA_SCHEMA_PATH        = var.minimal_scylla_schema_path
    SCYLLA_REQUEST_TIMEOUT_MS = tostring(var.minimal_scylla_request_timeout_ms)
  } : {}
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

check "rust_api_smoke_prerequisites" {
  assert {
    condition     = !var.enable_rust_api_smoke_deploy || var.enable_minimal_gke_cluster
    error_message = "enable_rust_api_smoke_deploy requires enable_minimal_gke_cluster = true."
  }

  assert {
    condition     = !var.enable_rust_api_smoke_deploy || local.rust_api_smoke_inputs_are_set
    error_message = "enable_rust_api_smoke_deploy requires rust_api_image_digest and a public hostname."
  }

  assert {
    condition     = !var.enable_rust_api_smoke_deploy || local.rust_api_smoke_edge_is_ready
    error_message = "enable_rust_api_smoke_deploy requires LIN-963 edge resources (certificate map and named public IPv4) to be enabled."
  }
}

check "exclusive_cluster_paths" {
  assert {
    condition     = !(var.enable_standard_gke_cluster_baseline && var.enable_minimal_gke_cluster)
    error_message = "enable_standard_gke_cluster_baseline and enable_minimal_gke_cluster cannot both be true in prod."
  }
}

check "exclusive_cloud_sql_paths" {
  assert {
    condition     = !(var.enable_standard_cloud_sql_baseline && var.enable_minimal_cloud_sql_baseline)
    error_message = "enable_standard_cloud_sql_baseline and enable_minimal_cloud_sql_baseline cannot both be true in prod."
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

check "minimal_monitoring_prerequisites" {
  assert {
    condition     = !var.enable_minimal_monitoring_baseline || var.enable_minimal_gke_cluster
    error_message = "enable_minimal_monitoring_baseline requires enable_minimal_gke_cluster = true."
  }

  assert {
    condition     = !var.enable_minimal_monitoring_baseline || var.enable_rust_api_smoke_deploy
    error_message = "enable_minimal_monitoring_baseline requires enable_rust_api_smoke_deploy = true."
  }

  assert {
    condition     = !var.enable_minimal_monitoring_baseline || var.enable_minimal_cloud_sql_baseline
    error_message = "enable_minimal_monitoring_baseline requires enable_minimal_cloud_sql_baseline = true."
  }
}

check "minimal_security_prerequisites" {
  assert {
    condition     = !var.enable_minimal_security_baseline || var.enable_rust_api_smoke_deploy
    error_message = "enable_minimal_security_baseline requires enable_rust_api_smoke_deploy = true."
  }
}

check "minimal_dragonfly_prerequisites" {
  assert {
    condition     = !var.enable_minimal_dragonfly_baseline || var.enable_minimal_gke_cluster
    error_message = "enable_minimal_dragonfly_baseline requires enable_minimal_gke_cluster = true."
  }

  assert {
    condition     = !var.enable_minimal_dragonfly_baseline || trimspace(var.minimal_dragonfly_image) != ""
    error_message = "enable_minimal_dragonfly_baseline requires minimal_dragonfly_image to be set."
  }
}

check "minimal_scylla_runtime_prerequisites" {
  assert {
    condition     = !var.enable_minimal_scylla_runtime_baseline || var.enable_rust_api_smoke_deploy
    error_message = "enable_minimal_scylla_runtime_baseline requires enable_rust_api_smoke_deploy = true."
  }

  assert {
    condition     = !var.enable_minimal_scylla_runtime_baseline || length(var.minimal_scylla_hosts) > 0
    error_message = "enable_minimal_scylla_runtime_baseline requires at least one minimal_scylla_hosts entry."
  }
}

check "minimal_managed_messaging_secret_prerequisites" {
  assert {
    condition = !var.enable_minimal_managed_messaging_secret_baseline || (
      length(var.minimal_redpanda_secret_ids) + length(var.minimal_nats_secret_ids)
    ) > 0
    error_message = "enable_minimal_managed_messaging_secret_baseline requires at least one Redpanda or NATS secret ID."
  }
}

check "minimal_search_secret_prerequisites" {
  assert {
    condition     = !var.enable_minimal_search_secret_baseline || length(var.minimal_search_secret_ids) > 0
    error_message = "enable_minimal_search_secret_baseline requires at least one Elastic Cloud secret ID."
  }
}

check "standard_cloud_sql_prerequisites" {
  assert {
    condition     = !var.standard_cloud_sql_prod_read_replica_enabled
    error_message = "LIN-968 standard baseline documents prod read replica as disabled. Keep standard_cloud_sql_prod_read_replica_enabled = false until a separate follow-up issue provisions it."
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

resource "google_project_iam_audit_config" "secret_manager_data_access" {
  count = (var.enable_minimal_gke_cluster || var.enable_standard_workload_identity_baseline) ? 1 : 0

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
    "prod-canary-smoke" = {
      destination_namespace = "api"
      path                  = "infra/gitops/apps/prod/canary-smoke"
      sync_policy = {
        automated = false
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
  availability_type       = var.standard_cloud_sql_prod_ha_enabled ? "REGIONAL" : "ZONAL"
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
  retained_backups  = var.standard_cloud_sql_prod_retained_backups
  tier              = var.standard_cloud_sql_tier

  depends_on = [module.network_foundation]
}

module "rust_api_runtime_identity" {
  count = var.enable_minimal_gke_cluster ? 1 : 0

  source = "../../modules/workload_identity_secret_manager_baseline"

  environment                       = local.environment
  google_service_account_account_id = "rust-api-smoke-runtime"
  kubernetes_namespace              = "rust-api-smoke"
  kubernetes_service_account_name   = "rust-api-smoke"
  labels = {
    environment = local.environment
    issue       = "lin-1016"
  }
  project_id    = var.project_id
  secret_ids    = var.rust_api_runtime_secret_ids
  workload_name = "rust-api-smoke"
}

module "rust_api_smoke_deploy" {
  count = local.enable_rust_api_smoke ? 1 : 0

  source = "../../modules/rust_api_smoke_deploy"

  certificate_map_name         = basename(module.network_foundation.public_certificate_map_name)
  deployment_name              = "rust-api-smoke"
  backend_security_policy_name = local.enable_minimal_security ? module.network_foundation.cloud_armor_policy_name : ""
  gateway_name                 = "rust-api-gateway"
  gateway_static_ip_name       = module.network_foundation.public_lb_ipv4_name
  health_check_policy_name     = "rust-api-healthcheck"
  image                        = var.rust_api_image_digest
  labels = {
    environment = local.environment
    issue       = "lin-1015"
  }
  namespace                   = "rust-api-smoke"
  public_hostname             = local.rust_api_public_hostname
  route_name                  = "rust-api-route"
  scylla_runtime_env          = local.minimal_scylla_runtime_env
  service_account_annotations = var.enable_minimal_gke_cluster ? module.rust_api_runtime_identity[0].kubernetes_service_account_annotations : {}
  service_account_name        = "rust-api-smoke"
  service_name                = "rust-api-smoke"

  depends_on = [
    google_project_iam_audit_config.secret_manager_data_access,
    module.gke_autopilot_minimal,
    module.rust_api_runtime_identity,
  ]
}

module "cloud_sql_postgres_minimal" {
  count = local.enable_minimal_cloud_sql ? 1 : 0

  source = "../../modules/cloud_sql_postgres_minimal"

  allocated_ip_range_name = module.network_foundation.private_service_access_range_name
  database_name           = var.minimal_cloud_sql_database_name
  disk_size_gb            = var.minimal_cloud_sql_disk_size_gb
  environment             = local.environment
  labels = {
    environment = local.environment
    issue       = "lin-1017"
  }
  network_self_link = module.network_foundation.network_self_link
  project_id        = var.project_id
  region            = var.region
  tier              = var.minimal_cloud_sql_tier

  depends_on = [module.network_foundation]
}

module "dragonfly_minimal" {
  count = local.enable_minimal_dragonfly ? 1 : 0

  source = "../../modules/dragonfly_minimal"

  deployment_name = "dragonfly"
  image           = var.minimal_dragonfly_image
  labels = {
    environment = local.environment
    issue       = "lin-1022"
  }
  namespace            = "dragonfly"
  service_account_name = "dragonfly"
  service_name         = "dragonfly"

  depends_on = [module.gke_autopilot_minimal]
}

module "managed_messaging_secret_placeholders" {
  count = local.enable_minimal_managed_messaging_secrets ? 1 : 0

  source = "../../modules/managed_messaging_secret_placeholders"

  environment         = local.environment
  nats_secret_ids     = var.minimal_nats_secret_ids
  redpanda_secret_ids = var.minimal_redpanda_secret_ids
  labels = {
    environment = local.environment
    issue       = "lin-1024"
  }
}

module "search_secret_placeholders" {
  count = local.enable_minimal_search_secrets ? 1 : 0

  source = "../../modules/search_secret_placeholders"

  elastic_secret_ids = var.minimal_search_secret_ids
  environment        = local.environment
  labels = {
    environment = local.environment
    issue       = "lin-1025"
  }
}

module "cloud_monitoring_minimal" {
  count = local.enable_minimal_monitoring ? 1 : 0

  source = "../../modules/cloud_monitoring_minimal"

  cloud_sql_instance_name        = module.cloud_sql_postgres_minimal[0].instance_name
  cluster_location               = module.gke_autopilot_minimal[0].cluster_location
  cluster_name                   = module.gke_autopilot_minimal[0].cluster_name
  environment                    = local.environment
  existing_notification_channels = var.minimal_monitoring_existing_notification_channels
  labels = {
    environment = local.environment
    issue       = "lin-1018"
  }
  notification_email_addresses = var.minimal_monitoring_alert_email_addresses
  project_id                   = var.project_id
  rust_api_namespace           = "rust-api-smoke"

  depends_on = [
    module.cloud_sql_postgres_minimal,
    module.gke_autopilot_minimal,
    module.rust_api_smoke_deploy,
  ]
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

output "gke_autopilot_minimal" {
  value = var.enable_minimal_gke_cluster ? module.gke_autopilot_minimal[0] : null
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
    bootstrap_kustomize_path = "infra/gitops/bootstrap/prod"
  }) : null
}

output "rust_api_runtime_identity" {
  value = var.enable_minimal_gke_cluster ? module.rust_api_runtime_identity[0] : null
}

output "rust_api_smoke_deploy" {
  value = local.enable_rust_api_smoke ? module.rust_api_smoke_deploy[0] : null
}

output "cloud_sql_postgres_minimal" {
  value = local.enable_minimal_cloud_sql ? module.cloud_sql_postgres_minimal[0] : null
}

output "cloud_monitoring_minimal" {
  value = local.enable_minimal_monitoring ? module.cloud_monitoring_minimal[0] : null
}

output "cloud_sql_postgres_standard" {
  value = local.enable_standard_cloud_sql ? module.cloud_sql_postgres_standard[0] : null
}

output "minimal_security_baseline_enabled" {
  value = local.enable_minimal_security
}

output "dragonfly_minimal" {
  value = local.enable_minimal_dragonfly ? module.dragonfly_minimal[0] : null
}

output "minimal_scylla_runtime_baseline_enabled" {
  value = local.enable_minimal_scylla_runtime
}

output "managed_messaging_secret_placeholders" {
  value = local.enable_minimal_managed_messaging_secrets ? module.managed_messaging_secret_placeholders[0] : null
}

output "search_secret_placeholders" {
  value = local.enable_minimal_search_secrets ? module.search_secret_placeholders[0] : null
}
