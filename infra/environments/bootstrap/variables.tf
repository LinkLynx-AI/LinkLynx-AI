variable "billing_account_id" {
  description = "Plain billing account ID like 000000-000000-000000."
  type        = string
}

variable "folder_id" {
  description = "Parent folder ID. Set this or org_id."
  type        = string
  default     = ""
}

variable "org_id" {
  description = "Parent organization ID. Set this or folder_id."
  type        = string
  default     = ""
}

variable "project_prefix" {
  description = "Project ID prefix."
  type        = string
  default     = "linklynx"
}

variable "project_display_name_prefix" {
  description = "Display name prefix."
  type        = string
  default     = "LinkLynx"
}

variable "bootstrap_project_id" {
  description = "Bootstrap project ID."
  type        = string
  default     = "linklynx-bootstrap"
}

variable "bootstrap_project_name" {
  description = "Bootstrap project name."
  type        = string
  default     = "LinkLynx Bootstrap"
}

variable "default_region" {
  description = "Default region for provider operations."
  type        = string
  default     = "us-east1"
}

variable "state_bucket_location" {
  description = "Location for the Terraform state bucket."
  type        = string
  default     = "us-east1"
}

variable "state_bucket_name" {
  description = "Override for the Terraform state bucket name. Leave empty to auto-generate."
  type        = string
  default     = ""
}

variable "budget_currency" {
  description = "Budget currency."
  type        = string
  default     = "JPY"
}

variable "environment_budgets" {
  description = "Monthly budget baseline per runtime environment."
  type = object({
    staging = number
    prod    = number
  })
  default = {
    staging = 300000
    prod    = 1500000
  }
}

variable "budget_monitoring_notification_channels" {
  description = "Optional Cloud Monitoring notification channels for budget alerts."
  type        = list(string)
  default     = []
}

variable "disable_default_budget_alert_recipients" {
  description = "Disable default IAM billing recipients."
  type        = bool
  default     = false
}

variable "common_labels" {
  description = "Common labels applied to all bootstrap-created resources."
  type        = map(string)
  default = {
    managed_by = "terraform"
    repository = "linklynx-ai"
  }
}

variable "bootstrap_project_services" {
  description = "Services enabled on the bootstrap project."
  type        = list(string)
  default = [
    "cloudbilling.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com",
    "serviceusage.googleapis.com",
    "storage.googleapis.com",
  ]
}

variable "project_services" {
  description = "Baseline services enabled on runtime projects."
  type        = list(string)
  default = [
    "artifactregistry.googleapis.com",
    "certificatemanager.googleapis.com",
    "cloudbilling.googleapis.com",
    "compute.googleapis.com",
    "container.googleapis.com",
    "dns.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com",
    "secretmanager.googleapis.com",
    "serviceusage.googleapis.com",
    "servicenetworking.googleapis.com",
    "sqladmin.googleapis.com",
  ]
}

variable "terraform_admin_service_account_id" {
  description = "Account ID for the Terraform admin service account."
  type        = string
  default     = "terraform-admin"
}

variable "terraform_admin_bootstrap_roles" {
  description = "Project roles granted to the Terraform admin service account on the bootstrap project."
  type        = list(string)
  default     = ["roles/owner"]
}

variable "terraform_admin_project_roles" {
  description = "Project roles granted to the Terraform admin service account on runtime projects."
  type        = list(string)
  default     = ["roles/owner"]
}
