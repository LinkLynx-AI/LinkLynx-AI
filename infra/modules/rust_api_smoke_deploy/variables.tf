variable "namespace" {
  description = "Namespace for the smoke workload."
  type        = string
}

variable "service_account_name" {
  description = "Kubernetes service account name for the smoke workload."
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

variable "gateway_name" {
  description = "Gateway name."
  type        = string
}

variable "route_name" {
  description = "HTTPRoute name."
  type        = string
}

variable "health_check_policy_name" {
  description = "HealthCheckPolicy name."
  type        = string
}

variable "public_hostname" {
  description = "Public hostname without a trailing dot."
  type        = string
}

variable "gateway_static_ip_name" {
  description = "Name of the reserved global static IP resource."
  type        = string
}

variable "certificate_map_name" {
  description = "Short certificate map name used by the Gateway annotation."
  type        = string
}

variable "image" {
  description = "Container image including immutable digest."
  type        = string
}

variable "cpu_request" {
  description = "CPU request baseline."
  type        = string
  default     = "500m"
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

variable "replicas" {
  description = "Replica count for the smoke workload."
  type        = number
  default     = 1
}

variable "labels" {
  description = "Additional labels."
  type        = map(string)
  default     = {}
}

variable "service_account_annotations" {
  description = "Optional annotations applied to the Kubernetes service account."
  type        = map(string)
  default     = {}
}

variable "backend_security_policy_name" {
  description = "Optional Cloud Armor backend security policy name attached via GCPBackendPolicy."
  type        = string
  default     = ""
}

variable "scylla_runtime_env" {
  description = "Optional Scylla runtime environment variables injected into the workload."
  type        = map(string)
  default     = {}
}
