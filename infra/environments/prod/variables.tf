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
