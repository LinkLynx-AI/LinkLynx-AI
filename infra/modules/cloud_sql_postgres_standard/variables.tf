variable "environment" {
  description = "Environment name."
  type        = string
}

variable "project_id" {
  description = "Target GCP project ID."
  type        = string
}

variable "region" {
  description = "Primary region for the Cloud SQL instance."
  type        = string
}

variable "network_self_link" {
  description = "Self link of the VPC used for private IP connectivity."
  type        = string
}

variable "allocated_ip_range_name" {
  description = "Private services access range name reserved for Google-managed producer services."
  type        = string
}

variable "instance_name" {
  description = "Optional override for the Cloud SQL instance name."
  type        = string
  default     = ""
}

variable "database_name" {
  description = "Application database name to create."
  type        = string
  default     = "linklynx"
}

variable "database_version" {
  description = "Cloud SQL PostgreSQL version."
  type        = string
  default     = "POSTGRES_16"
}

variable "tier" {
  description = "Cloud SQL machine tier."
  type        = string
  default     = "db-custom-4-16384"
}

variable "availability_type" {
  description = "Cloud SQL availability type."
  type        = string
  default     = "ZONAL"

  validation {
    condition     = contains(["ZONAL", "REGIONAL"], var.availability_type)
    error_message = "availability_type must be ZONAL or REGIONAL."
  }
}

variable "disk_type" {
  description = "Storage type."
  type        = string
  default     = "PD_SSD"
}

variable "disk_size_gb" {
  description = "Initial storage size in GB."
  type        = number
  default     = 100

  validation {
    condition     = var.disk_size_gb >= 10
    error_message = "disk_size_gb must be at least 10 GB."
  }
}

variable "disk_autoresize" {
  description = "Whether Cloud SQL can increase storage automatically."
  type        = bool
  default     = true
}

variable "deletion_protection" {
  description = "Protect the Cloud SQL instance from deletion in Terraform and GCP."
  type        = bool
  default     = true
}

variable "backup_start_time" {
  description = "Daily backup start time in UTC, HH:MM."
  type        = string
  default     = "03:00"
}

variable "retained_backups" {
  description = "Number of retained automated backups."
  type        = number
  default     = 14
}

variable "transaction_log_retention_days" {
  description = "PITR transaction log retention period in days."
  type        = number
  default     = 7
}

variable "point_in_time_recovery_enabled" {
  description = "Whether PITR is enabled."
  type        = bool
  default     = true
}

variable "maintenance_day" {
  description = "Maintenance window day (1-7)."
  type        = number
  default     = 7
}

variable "maintenance_hour" {
  description = "Maintenance window hour in UTC (0-23)."
  type        = number
  default     = 4
}

variable "maintenance_update_track" {
  description = "Maintenance update track."
  type        = string
  default     = "stable"
}

variable "labels" {
  description = "Additional resource labels."
  type        = map(string)
  default     = {}
}
