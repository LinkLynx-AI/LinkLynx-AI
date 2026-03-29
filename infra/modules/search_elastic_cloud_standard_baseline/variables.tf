variable "environment" {
  description = "Environment name."
  type        = string
}

variable "labels" {
  description = "Additional labels."
  type        = map(string)
  default     = {}
}

variable "secret_ids" {
  description = "Secret Manager secret IDs keyed by logical role for Elastic Cloud."
  type        = map(string)

  validation {
    condition     = length(setsubtract(toset(["api_key", "cloud_id", "endpoint"]), toset(keys(var.secret_ids)))) == 0
    error_message = "secret_ids must contain api_key, cloud_id, and endpoint entries."
  }
}

variable "accessor_service_account_emails" {
  description = "Runtime GSA emails allowed to access the Elastic Cloud secrets."
  type        = set(string)

  validation {
    condition     = length(var.accessor_service_account_emails) > 0
    error_message = "accessor_service_account_emails must contain at least one runtime service account."
  }
}

variable "index_name" {
  description = "Primary search index name used by the runtime contract."
  type        = string
  default     = "messages"

  validation {
    condition     = trimspace(var.index_name) != ""
    error_message = "index_name must not be empty."
  }
}
