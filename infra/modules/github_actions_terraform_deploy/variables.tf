variable "bootstrap_project_id" {
  description = "Bootstrap project ID."
  type        = string
}

variable "bootstrap_project_number" {
  description = "Bootstrap project number."
  type        = string
}

variable "deployer_service_account_id_prefix" {
  description = "Prefix used for GitHub Terraform deployer service accounts."
  type        = string
}

variable "environment_names" {
  description = "Environment names that receive Terraform deployer service accounts."
  type        = set(string)
}

variable "github_repository" {
  description = "GitHub repository in owner/name format."
  type        = string
}

variable "state_bucket_name" {
  description = "Terraform state bucket name."
  type        = string
}

variable "terraform_admin_service_account_name" {
  description = "Fully qualified Terraform admin service account resource name."
  type        = string
}

variable "workload_identity_pool_id" {
  description = "Workload Identity Pool ID shared with GitHub Actions."
  type        = string
}
