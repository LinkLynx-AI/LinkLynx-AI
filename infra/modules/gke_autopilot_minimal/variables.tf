variable "project_id" {
  description = "Project ID that owns the cluster."
  type        = string
}

variable "environment" {
  description = "Environment name used in resource naming."
  type        = string
}

variable "region" {
  description = "Regional location for the Autopilot cluster."
  type        = string
}

variable "network_self_link" {
  description = "VPC self link used by the cluster."
  type        = string
}

variable "subnetwork_self_link" {
  description = "Subnetwork self link used by the cluster."
  type        = string
}

variable "pods_secondary_range_name" {
  description = "Secondary range name used for pod IP allocation."
  type        = string
}

variable "services_secondary_range_name" {
  description = "Secondary range name used for service IP allocation."
  type        = string
}

variable "cluster_name" {
  description = "Optional cluster name override."
  type        = string
  default     = ""
}

variable "release_channel" {
  description = "GKE release channel."
  type        = string
  default     = "REGULAR"

  validation {
    condition     = contains(["RAPID", "REGULAR", "STABLE", "UNSPECIFIED"], var.release_channel)
    error_message = "release_channel must be RAPID, REGULAR, STABLE, or UNSPECIFIED."
  }
}

variable "deletion_protection" {
  description = "Whether Terraform should protect the cluster from deletion."
  type        = bool
  default     = false
}

variable "node_service_account_account_id" {
  description = "Account ID for the custom Autopilot node service account."
  type        = string
  default     = "gke-autopilot-node"
}

variable "fixed_request_cpu" {
  description = "Documented initial CPU request baseline for the first Rust API deployment."
  type        = string
  default     = "500m"
}

variable "fixed_request_memory" {
  description = "Documented initial memory request baseline for the first Rust API deployment."
  type        = string
  default     = "512Mi"
}

variable "fixed_request_ephemeral_storage" {
  description = "Documented initial ephemeral storage request baseline for the first Rust API deployment."
  type        = string
  default     = "1Gi"
}

variable "recommended_namespaces" {
  description = "Recommended namespace baseline for the low-budget prod-only cluster."
  type        = list(string)
  default     = ["app", "ops"]
}

variable "labels" {
  description = "Additional labels applied to supported resources."
  type        = map(string)
  default     = {}
}
