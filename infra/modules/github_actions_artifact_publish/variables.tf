variable "bootstrap_project_id" {
  description = "Bootstrap project ID."
  type        = string
}

variable "bootstrap_project_number" {
  description = "Bootstrap project number."
  type        = string
}

variable "environment_project_ids" {
  description = "Runtime project IDs keyed by environment."
  type        = map(string)
}

variable "github_repository" {
  description = "GitHub repository in owner/name format."
  type        = string
}

variable "github_repository_owner" {
  description = "GitHub repository owner or organization."
  type        = string
}

variable "workload_identity_pool_id" {
  description = "Workload Identity Pool ID."
  type        = string
}

variable "workload_identity_provider_id" {
  description = "Workload Identity Provider ID."
  type        = string
}

variable "publisher_service_account_id_prefix" {
  description = "Prefix used for GitHub artifact publisher service accounts."
  type        = string
}
