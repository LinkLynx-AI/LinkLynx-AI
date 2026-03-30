variable "environment" {
  description = "Environment name."
  type        = string
}

variable "project_id" {
  description = "Target GCP project ID."
  type        = string
}

variable "cluster_name" {
  description = "GKE cluster name."
  type        = string
}

variable "cluster_location" {
  description = "GKE cluster location."
  type        = string
}

variable "rust_api_namespace" {
  description = "Namespace of the low-budget Rust API smoke workload."
  type        = string
}

variable "rust_api_container_name" {
  description = "Container name of the low-budget Rust API workload."
  type        = string
  default     = "rust-api"
}

variable "cloud_sql_instance_name" {
  description = "Cloud SQL instance name for the low-budget prod-only baseline."
  type        = string
}

variable "notification_email_addresses" {
  description = "Email notification channels to create."
  type        = set(string)
  default     = []
}

variable "existing_notification_channels" {
  description = "Existing Cloud Monitoring notification channel resource names."
  type        = list(string)
  default     = []
}

variable "labels" {
  description = "Additional resource labels."
  type        = map(string)
  default     = {}
}
