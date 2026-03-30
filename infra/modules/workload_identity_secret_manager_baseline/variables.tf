variable "project_id" {
  description = "Project ID that owns the workload identity and secrets."
  type        = string
}

variable "environment" {
  description = "Environment name for labels and display names."
  type        = string
}

variable "workload_name" {
  description = "Human-readable workload name."
  type        = string
}

variable "google_service_account_account_id" {
  description = "Account ID for the Google service account used by the workload."
  type        = string
}

variable "google_service_account_display_name" {
  description = "Optional display name override for the Google service account."
  type        = string
  default     = ""
}

variable "kubernetes_namespace" {
  description = "Namespace for the Kubernetes service account."
  type        = string
}

variable "kubernetes_service_account_name" {
  description = "Kubernetes service account name bound to the Google service account."
  type        = string
}

variable "manage_kubernetes_service_account" {
  description = "Whether the module should create and annotate the Kubernetes service account."
  type        = bool
  default     = false
}

variable "kubernetes_service_account_automount_token" {
  description = "Whether the managed Kubernetes service account should automount its token."
  type        = bool
  default     = true
}

variable "secret_ids" {
  description = "Secret Manager secret IDs created and granted to the workload."
  type        = set(string)
  default     = []
}

variable "labels" {
  description = "Additional labels applied to secrets."
  type        = map(string)
  default     = {}
}
