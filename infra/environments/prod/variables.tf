variable "project_id" {
  description = "Production project ID."
  type        = string
  default     = "linklynx-prod"
}

variable "region" {
  description = "Primary region."
  type        = string
  default     = "us-east1"
}

variable "terraform_admin_service_account_email" {
  description = "Optional impersonated service account email."
  type        = string
  default     = ""
}

variable "public_dns_zone_name" {
  description = "Cloud DNS zone name for production edge hostnames."
  type        = string
  default     = ""
}

variable "public_dns_name" {
  description = "Cloud DNS suffix for production public records, for example example.com."
  type        = string
  default     = ""
}

variable "public_hostnames" {
  description = "Public production hostnames attached to the shared edge IP and managed certificate."
  type        = set(string)
  default     = []
}

variable "artifact_registry_repository_id" {
  description = "Artifact Registry repository ID for deployable container images."
  type        = string
  default     = "application-images"
}

variable "enable_minimal_gke_cluster" {
  description = "Whether to create the low-budget prod-only GKE Autopilot cluster baseline."
  type        = bool
  default     = true
}

variable "enable_standard_gke_cluster_baseline" {
  description = "Whether to create the standard prod GKE Autopilot cluster and namespace baseline."
  type        = bool
  default     = false
}

variable "standard_gke_release_channel" {
  description = "Release channel used by the standard prod GKE cluster baseline."
  type        = string
  default     = "REGULAR"
}

variable "standard_gke_namespace_names" {
  description = "Namespaces created by the standard prod cluster baseline."
  type        = set(string)
  default     = ["frontend", "api", "ai", "data", "ops", "observability"]
}

variable "enable_standard_workload_identity_baseline" {
  description = "Whether to create the standard prod Workload Identity + Secret Manager baseline."
  type        = bool
  default     = false
}

variable "enable_standard_gitops_baseline" {
  description = "Whether to install Argo CD / Argo Rollouts and expose the standard GitOps bootstrap path."
  type        = bool
  default     = false
}

variable "enable_standard_cloud_sql_baseline" {
  description = "Whether to create the standard prod Cloud SQL baseline."
  type        = bool
  default     = false
}

variable "enable_standard_dragonfly_baseline" {
  description = "Whether to create the standard prod Dragonfly StatefulSet baseline."
  type        = bool
  default     = false
}

variable "enable_standard_scylla_cloud_baseline" {
  description = "Whether to create the standard prod ScyllaDB Cloud connection baseline."
  type        = bool
  default     = false
}

variable "enable_standard_managed_messaging_cloud_baseline" {
  description = "Whether to create the standard prod Redpanda Cloud / Synadia Cloud connection baseline."
  type        = bool
  default     = false
}

variable "enable_standard_observability_baseline" {
  description = "Whether to create the standard prod observability baseline."
  type        = bool
  default     = false
}

variable "standard_dragonfly_image" {
  description = "Dragonfly image used by the standard prod baseline."
  type        = string
  default     = ""
}

variable "standard_dragonfly_storage_size" {
  description = "Persistent storage size for the standard prod Dragonfly baseline."
  type        = string
  default     = "20Gi"
}

variable "standard_dragonfly_allowed_client_namespaces" {
  description = "Namespaces allowed to reach the standard prod Dragonfly service."
  type        = set(string)
  default     = ["api"]
}

variable "standard_scylla_hosts" {
  description = "ScyllaDB Cloud contact points for the standard prod baseline."
  type        = set(string)
  default     = []
}

variable "standard_scylla_keyspace" {
  description = "Scylla keyspace for the standard prod baseline."
  type        = string
  default     = "chat"
}

variable "standard_scylla_schema_path" {
  description = "Schema artifact path expected by the standard prod Scylla runtime contract."
  type        = string
  default     = "/app/database/scylla/001_lin139_messages.cql"
}

variable "standard_scylla_request_timeout_ms" {
  description = "Runtime request timeout for the standard prod Scylla baseline."
  type        = number
  default     = 1000
}

variable "standard_scylla_disallow_shard_aware_port" {
  description = "Whether the standard prod Scylla baseline disables shard-aware ports by default."
  type        = bool
  default     = true
}

variable "standard_scylla_runtime_workloads" {
  description = "Standard runtime workloads that receive Scylla secret access."
  type        = set(string)
  default     = ["api"]
}

variable "standard_scylla_secret_ids" {
  description = "Secret Manager secret IDs keyed by logical role for the standard prod Scylla baseline."
  type        = map(string)
  default = {
    username  = "linklynx-prod-scylla-username"
    password  = "linklynx-prod-scylla-password"
    ca_bundle = "linklynx-prod-scylla-ca-bundle"
  }
}

variable "standard_redpanda_runtime_workloads" {
  description = "Standard runtime workloads that receive Redpanda secret access."
  type        = set(string)
  default     = ["api"]
}

variable "standard_nats_runtime_workloads" {
  description = "Standard runtime workloads that receive NATS secret access."
  type        = set(string)
  default     = ["api"]
}

variable "standard_redpanda_secret_ids" {
  description = "Secret Manager secret IDs keyed by logical role for the standard prod Redpanda baseline."
  type        = map(string)
  default = {
    bootstrap_servers = "linklynx-prod-redpanda-bootstrap-servers"
    sasl_username     = "linklynx-prod-redpanda-sasl-username"
    sasl_password     = "linklynx-prod-redpanda-sasl-password"
    ca_bundle         = "linklynx-prod-redpanda-ca-bundle"
  }
}

variable "standard_nats_secret_ids" {
  description = "Secret Manager secret IDs keyed by logical role for the standard prod NATS baseline."
  type        = map(string)
  default = {
    url       = "linklynx-prod-nats-url"
    creds     = "linklynx-prod-nats-creds"
    ca_bundle = "linklynx-prod-nats-ca-bundle"
  }
}

variable "standard_redpanda_smoke_topic" {
  description = "Dedicated Redpanda smoke topic for the standard prod baseline."
  type        = string
  default     = "llx.prod.v1.derived.ops.messaging_smoke.v1"
}

variable "standard_nats_smoke_subject" {
  description = "Dedicated NATS smoke subject for the standard prod baseline."
  type        = string
  default     = "v0.ops.messaging_smoke"
}

variable "standard_cloud_sql_database_name" {
  description = "Application database name for the standard prod Cloud SQL baseline."
  type        = string
  default     = "linklynx"
}

variable "standard_cloud_sql_tier" {
  description = "Cloud SQL machine tier for the standard prod baseline."
  type        = string
  default     = "db-custom-4-16384"
}

variable "standard_cloud_sql_disk_size_gb" {
  description = "Initial storage size for the standard prod Cloud SQL baseline."
  type        = number
  default     = 100
}

variable "standard_cloud_sql_prod_retained_backups" {
  description = "Retained automated backups for the standard prod Cloud SQL baseline."
  type        = number
  default     = 14
}

variable "standard_cloud_sql_prod_ha_enabled" {
  description = "Whether the standard prod Cloud SQL baseline uses REGIONAL high availability."
  type        = bool
  default     = true
}

variable "standard_cloud_sql_prod_read_replica_enabled" {
  description = "Whether the standard prod Cloud SQL baseline should provision a read replica. LIN-968 keeps this disabled."
  type        = bool
  default     = false
}

variable "standard_gitops_repository_url" {
  description = "Repository URL watched by the standard prod GitOps baseline."
  type        = string
  default     = "https://github.com/LinkLynx-AI/LinkLynx-AI.git"
}

variable "standard_gitops_target_revision" {
  description = "Git revision watched by the standard prod GitOps baseline."
  type        = string
  default     = "main"
}

variable "standard_gitops_argocd_chart_version" {
  description = "Optional pinned Argo CD chart version for the standard prod GitOps baseline."
  type        = string
  default     = ""
}

variable "standard_gitops_rollouts_chart_version" {
  description = "Optional pinned Argo Rollouts chart version for the standard prod GitOps baseline."
  type        = string
  default     = ""
}

variable "standard_observability_discord_webhook_url" {
  description = "Discord webhook URL used by the standard prod Alertmanager baseline."
  type        = string
  default     = ""
  sensitive   = true
}

variable "standard_observability_discord_mention" {
  description = "Optional Discord mention text prepended to standard prod alerts."
  type        = string
  default     = "@here"
}

variable "standard_api_probe_targets" {
  description = "HTTP(S) healthcheck URLs used by the standard prod blackbox probe baseline."
  type        = set(string)
  default     = []
}

variable "standard_redpanda_probe_targets" {
  description = "Redpanda probe targets used by the standard prod blackbox baseline. Use host:port form."
  type        = set(string)
  default     = []
}

variable "standard_nats_probe_targets" {
  description = "NATS probe targets used by the standard prod blackbox baseline. Use host:port or provider-required URL form."
  type        = set(string)
  default     = []
}

variable "standard_observability_kube_prometheus_stack_chart_version" {
  description = "Optional pinned kube-prometheus-stack chart version for the standard prod observability baseline."
  type        = string
  default     = ""
}

variable "standard_observability_loki_chart_version" {
  description = "Optional pinned Loki chart version for the standard prod observability baseline."
  type        = string
  default     = ""
}

variable "standard_observability_alloy_chart_version" {
  description = "Optional pinned Alloy chart version for the standard prod observability baseline."
  type        = string
  default     = ""
}

variable "standard_observability_blackbox_chart_version" {
  description = "Optional pinned Prometheus Blackbox Exporter chart version for the standard prod observability baseline."
  type        = string
  default     = ""
}

variable "standard_observability_prometheus_retention" {
  description = "Prometheus retention period for the standard prod observability baseline."
  type        = string
  default     = "15d"
}

variable "standard_observability_prometheus_storage_size" {
  description = "Prometheus PVC size for the standard prod observability baseline."
  type        = string
  default     = "50Gi"
}

variable "standard_observability_alertmanager_storage_size" {
  description = "Alertmanager PVC size for the standard prod observability baseline."
  type        = string
  default     = "10Gi"
}

variable "standard_observability_grafana_storage_size" {
  description = "Grafana PVC size for the standard prod observability baseline."
  type        = string
  default     = "10Gi"
}

variable "standard_observability_loki_storage_size" {
  description = "Loki PVC size for the standard prod observability baseline."
  type        = string
  default     = "20Gi"
}

variable "standard_observability_loki_retention_period" {
  description = "Loki retention period for the standard prod observability baseline."
  type        = string
  default     = "168h"
}

variable "standard_runtime_secret_ids" {
  description = "Per-workload Secret Manager secret IDs reserved for the standard prod baseline."
  type        = map(list(string))
  default = {
    frontend = ["linklynx-prod-frontend-runtime"]
    api      = ["linklynx-prod-api-runtime"]
    ai       = ["linklynx-prod-ai-runtime"]
  }
}

variable "enable_rust_api_smoke_deploy" {
  description = "Whether to create the prod Rust API smoke workload on the minimal cluster."
  type        = bool
  default     = false
}

variable "rust_api_public_hostname" {
  description = "Public hostname without a trailing dot for the Rust API smoke route. Defaults to the first public hostname when empty."
  type        = string
  default     = ""
}

variable "rust_api_image_digest" {
  description = "Artifact Registry image digest reference for the Rust API smoke workload."
  type        = string
  default     = ""

  validation {
    condition     = var.rust_api_image_digest == "" || can(regex("^.+@sha256:[a-f0-9]{64}$", var.rust_api_image_digest))
    error_message = "rust_api_image_digest must be empty or a full image reference ending with @sha256:<64 lowercase hex>."
  }
}

variable "rust_api_runtime_secret_ids" {
  description = "Secret Manager secret IDs reserved for the prod Rust API runtime baseline."
  type        = set(string)
  default     = ["linklynx-prod-rust-api-smoke-runtime"]
}

variable "enable_minimal_cloud_sql_baseline" {
  description = "Whether to create the low-budget prod-only Cloud SQL baseline."
  type        = bool
  default     = false
}

variable "minimal_cloud_sql_database_name" {
  description = "Application database name for the low-budget Cloud SQL baseline."
  type        = string
  default     = "linklynx"
}

variable "minimal_cloud_sql_tier" {
  description = "Cloud SQL machine tier for the low-budget prod-only baseline."
  type        = string
  default     = "db-g1-small"
}

variable "minimal_cloud_sql_disk_size_gb" {
  description = "Initial storage size for the low-budget Cloud SQL baseline."
  type        = number
  default     = 20
}

variable "enable_minimal_monitoring_baseline" {
  description = "Whether to create the low-budget prod-only Cloud Monitoring baseline."
  type        = bool
  default     = false
}

variable "minimal_monitoring_alert_email_addresses" {
  description = "Email notification channels to create for the low-budget monitoring baseline."
  type        = set(string)
  default     = []
}

variable "minimal_monitoring_existing_notification_channels" {
  description = "Existing Cloud Monitoring notification channel resource names to attach."
  type        = list(string)
  default     = []
}

variable "enable_minimal_security_baseline" {
  description = "Whether to attach the low-budget prod-only Cloud Armor security baseline."
  type        = bool
  default     = false
}

variable "enable_minimal_dragonfly_baseline" {
  description = "Whether to create the low-budget prod-only Dragonfly baseline."
  type        = bool
  default     = false
}

variable "minimal_dragonfly_image" {
  description = "Dragonfly image used by the low-budget prod-only baseline."
  type        = string
  default     = ""
}

variable "enable_minimal_scylla_runtime_baseline" {
  description = "Whether to inject the low-budget Scylla runtime baseline into the Rust API smoke workload."
  type        = bool
  default     = false
}

variable "minimal_scylla_hosts" {
  description = "External Scylla contact points for the low-budget runtime baseline."
  type        = set(string)
  default     = []
}

variable "minimal_scylla_keyspace" {
  description = "Scylla keyspace used by the low-budget runtime baseline."
  type        = string
  default     = "chat"
}

variable "minimal_scylla_schema_path" {
  description = "Scylla schema file path inside the Rust API container image."
  type        = string
  default     = "/app/database/scylla/001_lin139_messages.cql"
}

variable "minimal_scylla_request_timeout_ms" {
  description = "Scylla request timeout in milliseconds for the low-budget runtime baseline."
  type        = number
  default     = 1000

  validation {
    condition     = var.minimal_scylla_request_timeout_ms > 0
    error_message = "minimal_scylla_request_timeout_ms must be a positive number."
  }
}

variable "enable_minimal_managed_messaging_secret_baseline" {
  description = "Whether to create Secret Manager placeholders for the low-budget managed messaging baseline."
  type        = bool
  default     = false
}

variable "minimal_redpanda_secret_ids" {
  description = "Secret Manager secret IDs reserved for low-budget Redpanda Cloud connection material."
  type        = set(string)
  default = [
    "linklynx-prod-redpanda-bootstrap-servers",
    "linklynx-prod-redpanda-sasl-password",
    "linklynx-prod-redpanda-sasl-username",
  ]
}

variable "minimal_nats_secret_ids" {
  description = "Secret Manager secret IDs reserved for low-budget Synadia / NATS connection material."
  type        = set(string)
  default = [
    "linklynx-prod-nats-creds",
    "linklynx-prod-nats-url",
  ]
}

variable "enable_minimal_search_secret_baseline" {
  description = "Whether to create Secret Manager placeholders for the low-budget search baseline."
  type        = bool
  default     = false
}

variable "minimal_search_secret_ids" {
  description = "Secret Manager secret IDs reserved for low-budget Elastic Cloud connection material."
  type        = set(string)
  default = [
    "linklynx-prod-search-elastic-api-key",
    "linklynx-prod-search-elastic-cloud-id",
    "linklynx-prod-search-elastic-endpoint",
  ]
}
