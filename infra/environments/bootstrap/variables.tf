variable "billing_account_id" {
  description = "Plain billing account ID like 000000-000000-000000."
  type        = string

  validation {
    condition     = can(regex("^[0-9]{6}-[0-9]{6}-[0-9]{6}$", var.billing_account_id))
    error_message = "Billing account ID must be in format 000000-000000-000000."
  }
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

variable "state_bucket_kms_key_name" {
  description = "Optional CMEK key for the Terraform state bucket."
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

variable "budget_alert_thresholds" {
  description = "Budget alert thresholds expressed as 0-1 ratios."
  type        = list(number)
  default     = [0.5, 0.8, 1.0]

  validation {
    condition     = length(var.budget_alert_thresholds) > 0 && alltrue([for threshold in var.budget_alert_thresholds : threshold > 0 && threshold <= 1])
    error_message = "Budget alert thresholds must be ratios between 0 and 1."
  }
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
    "sts.googleapis.com",
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
    "containerscanning.googleapis.com",
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

variable "github_repository" {
  description = "GitHub repository in owner/name format allowed to publish images."
  type        = string
  default     = "LinkLynx-AI/LinkLynx-AI"
}

variable "github_repository_owner" {
  description = "GitHub repository owner or organization allowed by the workload identity provider."
  type        = string
  default     = "LinkLynx-AI"
}

variable "github_actions_workload_identity_pool_id" {
  description = "Workload Identity Pool ID used by GitHub Actions."
  type        = string
  default     = "github-actions"
}

variable "github_actions_workload_identity_provider_id" {
  description = "Workload Identity Provider ID used by GitHub Actions."
  type        = string
  default     = "linklynx-ai"
}

variable "github_actions_publisher_service_account_id_prefix" {
  description = "Prefix used for per-environment GitHub Artifact Registry publisher service accounts."
  type        = string
  default     = "github-artifact-publisher"
}

variable "github_actions_terraform_deployer_service_account_id_prefix" {
  description = "Prefix used for per-environment GitHub Terraform deployer service accounts."
  type        = string
  default     = "github-terraform-deployer"
}

variable "terraform_admin_bootstrap_roles" {
  description = "Project roles granted to the Terraform admin service account on the bootstrap project."
  type        = list(string)
  default = [
    "roles/iam.serviceAccountAdmin",
    "roles/resourcemanager.projectIamAdmin",
    "roles/serviceusage.serviceUsageAdmin",
    "roles/storage.admin",
  ]
}

variable "terraform_admin_project_roles" {
  description = "Project roles granted to the Terraform admin service account on runtime projects."
  type        = list(string)
  default = [
    "roles/artifactregistry.admin",
    "roles/certificatemanager.editor",
    "roles/cloudsql.admin",
    "roles/compute.admin",
    "roles/container.admin",
    "roles/dns.admin",
    "roles/iam.serviceAccountAdmin",
    "roles/resourcemanager.projectIamAdmin",
    "roles/secretmanager.admin",
    "roles/serviceusage.serviceUsageAdmin",
  ]
}
