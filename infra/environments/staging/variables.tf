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

variable "public_dns_zone_name" {
  description = "Cloud DNS zone name for staging edge hostnames."
  type        = string
  default     = ""
}

variable "public_dns_name" {
  description = "Cloud DNS suffix for staging public records, for example staging.example.com."
  type        = string
  default     = ""
}

variable "public_hostnames" {
  description = "Public staging hostnames attached to the shared edge IP and managed certificate."
  type        = set(string)
  default     = []
}
