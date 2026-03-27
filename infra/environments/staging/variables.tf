variable "project_id" {
  description = "Staging project ID."
  type        = string
  default     = "linklynx-staging"
}

variable "region" {
  description = "Primary region."
  type        = string
  default     = "us-east1"
}

variable "terraform_admin_service_account_email" {
  description = "Optional impersonated service account email."
  type        = string
  default     = ""
}
