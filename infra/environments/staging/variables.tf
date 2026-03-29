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
