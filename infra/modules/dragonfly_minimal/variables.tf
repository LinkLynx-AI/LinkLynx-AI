variable "namespace" {
  description = "Namespace for the low-budget Dragonfly workload."
  type        = string
}

variable "service_account_name" {
  description = "Kubernetes service account name for the Dragonfly workload."
  type        = string
}

variable "deployment_name" {
  description = "Deployment name."
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

variable "port" {
  description = "Dragonfly service port."
  type        = number
  default     = 6379
}

variable "cpu_request" {
  description = "CPU request baseline."
  type        = string
  default     = "250m"
}

variable "memory_request" {
  description = "Memory request baseline."
  type        = string
  default     = "512Mi"
}

variable "ephemeral_storage_request" {
  description = "Ephemeral storage request baseline."
  type        = string
  default     = "1Gi"
}

variable "cpu_limit" {
  description = "CPU limit baseline."
  type        = string
  default     = "500m"
}

variable "memory_limit" {
  description = "Memory limit baseline."
  type        = string
  default     = "1Gi"
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
