variable "project_id" {
  description = "Staging project ID."
  type        = string
  default     = "linklynx-staging"
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
  description = "Cloud DNS zone name for staging edge hostnames."
  type        = string
  default     = ""
}

variable "public_dns_name" {
  description = "Cloud DNS suffix for staging public records, for example staging.example.com."
  type        = string
  default     = ""
}

variable "public_hostnames" {
  description = "Public staging hostnames attached to the shared edge IP and managed certificate."
  type        = set(string)
  default     = []
}

variable "artifact_registry_repository_id" {
  description = "Artifact Registry repository ID for deployable container images."
  type        = string
  default     = "application-images"
}

variable "enable_standard_gke_cluster_baseline" {
  description = "Whether to create the standard staging GKE Autopilot cluster and namespace baseline."
  type        = bool
  default     = false
}

variable "standard_gke_release_channel" {
  description = "Release channel used by the standard staging GKE cluster baseline."
  type        = string
  default     = "REGULAR"
}

variable "standard_gke_namespace_names" {
  description = "Namespaces created by the standard staging cluster baseline."
  type        = set(string)
  default     = ["frontend", "api", "ai", "data", "ops", "observability"]
}

variable "enable_standard_workload_identity_baseline" {
  description = "Whether to create the standard staging Workload Identity + Secret Manager baseline."
  type        = bool
  default     = false
}

variable "enable_standard_gitops_baseline" {
  description = "Whether to install Argo CD / Argo Rollouts and expose the standard GitOps bootstrap path."
  type        = bool
  default     = false
}

variable "enable_standard_cloud_sql_baseline" {
  description = "Whether to create the standard staging Cloud SQL baseline."
  type        = bool
  default     = false
}

variable "enable_standard_dragonfly_baseline" {
  description = "Whether to create the standard staging Dragonfly StatefulSet baseline."
  type        = bool
  default     = false
}

variable "enable_standard_scylla_cloud_baseline" {
  description = "Whether to create the standard staging ScyllaDB Cloud connection baseline."
  type        = bool
  default     = false
}

variable "standard_dragonfly_image" {
  description = "Dragonfly image used by the standard staging baseline."
  type        = string
  default     = ""
}

variable "standard_dragonfly_storage_size" {
  description = "Persistent storage size for the standard staging Dragonfly baseline."
  type        = string
  default     = "20Gi"
}

variable "standard_dragonfly_allowed_client_namespaces" {
  description = "Namespaces allowed to reach the standard staging Dragonfly service."
  type        = set(string)
  default     = ["api"]
}

variable "standard_scylla_hosts" {
  description = "ScyllaDB Cloud contact points for the standard staging baseline."
  type        = set(string)
  default     = []
}

variable "standard_scylla_keyspace" {
  description = "Scylla keyspace for the standard staging baseline."
  type        = string
  default     = "chat"
}

variable "standard_scylla_schema_path" {
  description = "Schema artifact path expected by the standard staging Scylla runtime contract."
  type        = string
  default     = "/app/database/scylla/001_lin139_messages.cql"
}

variable "standard_scylla_request_timeout_ms" {
  description = "Runtime request timeout for the standard staging Scylla baseline."
  type        = number
  default     = 1000
}

variable "standard_scylla_disallow_shard_aware_port" {
  description = "Whether the standard staging Scylla baseline disables shard-aware ports by default."
  type        = bool
  default     = true
}

variable "standard_scylla_runtime_workloads" {
  description = "Standard runtime workloads that receive Scylla secret access."
  type        = set(string)
  default     = ["api"]
}

variable "standard_scylla_secret_ids" {
  description = "Secret Manager secret IDs keyed by logical role for the standard staging Scylla baseline."
  type        = map(string)
  default = {
    username  = "linklynx-staging-scylla-username"
    password  = "linklynx-staging-scylla-password"
    ca_bundle = "linklynx-staging-scylla-ca-bundle"
  }
}

variable "standard_cloud_sql_database_name" {
  description = "Application database name for the standard staging Cloud SQL baseline."
  type        = string
  default     = "linklynx"
}

variable "standard_cloud_sql_tier" {
  description = "Cloud SQL machine tier for the standard staging baseline."
  type        = string
  default     = "db-custom-4-16384"
}

variable "standard_cloud_sql_disk_size_gb" {
  description = "Initial storage size for the standard staging Cloud SQL baseline."
  type        = number
  default     = 100
}

variable "standard_cloud_sql_staging_retained_backups" {
  description = "Retained automated backups for the standard staging Cloud SQL baseline."
  type        = number
  default     = 7
}

variable "standard_gitops_repository_url" {
  description = "Repository URL watched by the standard staging GitOps baseline."
  type        = string
  default     = "https://github.com/LinkLynx-AI/LinkLynx-AI.git"
}

variable "standard_gitops_target_revision" {
  description = "Git revision watched by the standard staging GitOps baseline."
  type        = string
  default     = "main"
}

variable "standard_gitops_argocd_chart_version" {
  description = "Optional pinned Argo CD chart version for the standard staging GitOps baseline."
  type        = string
  default     = ""
}

variable "standard_gitops_rollouts_chart_version" {
  description = "Optional pinned Argo Rollouts chart version for the standard staging GitOps baseline."
  type        = string
  default     = ""
}

variable "standard_runtime_secret_ids" {
  description = "Per-workload Secret Manager secret IDs reserved for the standard staging baseline."
  type        = map(list(string))
  default = {
    frontend = ["linklynx-staging-frontend-runtime"]
    api      = ["linklynx-staging-api-runtime"]
    ai       = ["linklynx-staging-ai-runtime"]
  }
}
