locals {
  environment                              = "prod"
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
  count = var.enable_minimal_gke_cluster ? 1 : 0

  project = var.project_id
  service = "secretmanager.googleapis.com"

  audit_log_config {
    log_type = "ADMIN_READ"
  }

  audit_log_config {
    log_type = "DATA_READ"
  }
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
