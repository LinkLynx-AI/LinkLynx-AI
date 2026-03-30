variable "namespace" {
  description = "Namespace for the standard Dragonfly workload."
  type        = string
}

variable "service_account_name" {
  description = "Kubernetes service account name for the Dragonfly workload."
  type        = string
}

variable "statefulset_name" {
  description = "StatefulSet name."
  type        = string
}

variable "service_name" {
  description = "Service name."
  type        = string
}

variable "image" {
  description = "Dragonfly container image."
  type        = string
}

variable "storage_size" {
  description = "Persistent volume size."
  type        = string
  default     = "20Gi"
}

variable "storage_class_name" {
  description = "Optional storage class name override."
  type        = string
  default     = ""
}

variable "port" {
  description = "Dragonfly service port."
  type        = number
  default     = 6379
}

variable "cpu_request" {
  description = "CPU request baseline."
  type        = string
  default     = "500m"
}

variable "memory_request" {
  description = "Memory request baseline."
  type        = string
  default     = "2Gi"
}

variable "ephemeral_storage_request" {
  description = "Ephemeral storage request baseline."
  type        = string
  default     = "1Gi"
}

variable "cpu_limit" {
  description = "CPU limit baseline."
  type        = string
  default     = "1"
}

variable "memory_limit" {
  description = "Memory limit baseline."
  type        = string
  default     = "4Gi"
}

variable "ephemeral_storage_limit" {
  description = "Ephemeral storage limit baseline."
  type        = string
  default     = "2Gi"
}

variable "labels" {
  description = "Additional labels."
  type        = map(string)
  default     = {}
}

variable "allowed_client_namespaces" {
  description = "Namespaces allowed to reach the Dragonfly service port."
  type        = set(string)
  default     = ["api"]

  validation {
    condition     = length(var.allowed_client_namespaces) > 0
    error_message = "allowed_client_namespaces must contain at least one namespace."
  }
}
