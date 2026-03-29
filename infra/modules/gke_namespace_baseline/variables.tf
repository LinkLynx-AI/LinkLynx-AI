variable "environment" {
  description = "Environment name used in labels."
  type        = string
}

variable "namespace_names" {
  description = "Namespaces created as the standard baseline."
  type        = set(string)
  default     = ["frontend", "api", "ai", "data", "ops", "observability"]

  validation {
    condition     = length(var.namespace_names) > 0
    error_message = "namespace_names must contain at least one namespace."
  }
}

variable "restricted_ingress_namespaces" {
  description = "Namespaces that receive default deny ingress plus same-namespace allow baseline."
  type        = set(string)
  default     = ["data", "ops", "observability"]
}

variable "ops_viewer_namespace" {
  description = "Namespace that hosts the read-only ops service account."
  type        = string
  default     = "ops"
}

variable "ops_viewer_service_account_name" {
  description = "Name of the read-only ops service account."
  type        = string
  default     = "ops-viewer"
}

variable "labels" {
  description = "Additional labels applied to supported resources."
  type        = map(string)
  default     = {}
}
