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
