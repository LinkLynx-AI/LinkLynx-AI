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
