variable "environment" {
  description = "Environment name."
  type        = string
}

variable "labels" {
  description = "Additional labels."
  type        = map(string)
  default     = {}
}

variable "redpanda_secret_ids" {
  description = "Secret Manager secret IDs keyed by logical role for Redpanda Cloud."
  type        = map(string)

  validation {
    condition = length(setsubtract(
      toset(["bootstrap_servers", "sasl_username", "sasl_password", "ca_bundle"]),
      toset(keys(var.redpanda_secret_ids)),
    )) == 0
    error_message = "redpanda_secret_ids must contain bootstrap_servers, sasl_username, sasl_password, and ca_bundle entries."
  }
}

variable "nats_secret_ids" {
  description = "Secret Manager secret IDs keyed by logical role for Synadia Cloud / NATS."
  type        = map(string)

  validation {
    condition = length(setsubtract(
      toset(["url", "creds", "ca_bundle"]),
      toset(keys(var.nats_secret_ids)),
    )) == 0
    error_message = "nats_secret_ids must contain url, creds, and ca_bundle entries."
  }
}

variable "redpanda_accessor_service_account_emails" {
  description = "Runtime GSA emails allowed to access the Redpanda secrets."
  type        = set(string)

  validation {
    condition     = length(var.redpanda_accessor_service_account_emails) > 0
    error_message = "redpanda_accessor_service_account_emails must contain at least one runtime service account."
  }
}

variable "nats_accessor_service_account_emails" {
  description = "Runtime GSA emails allowed to access the NATS secrets."
  type        = set(string)

  validation {
    condition     = length(var.nats_accessor_service_account_emails) > 0
    error_message = "nats_accessor_service_account_emails must contain at least one runtime service account."
  }
}

variable "redpanda_tls_enabled" {
  description = "Whether Redpanda Cloud connections require TLS."
  type        = bool
  default     = true
}

variable "nats_tls_enabled" {
  description = "Whether Synadia Cloud / NATS connections require TLS."
  type        = bool
  default     = true
}

variable "redpanda_authentication_mode" {
  description = "Logical authentication mode for Redpanda Cloud clients."
  type        = string
  default     = "sasl_tls"
}

variable "nats_authentication_mode" {
  description = "Logical authentication mode for Synadia Cloud / NATS clients."
  type        = string
  default     = "creds_tls"
}

variable "redpanda_smoke_topic" {
  description = "Dedicated smoke topic for Redpanda connectivity checks."
  type        = string

  validation {
    condition     = trimspace(var.redpanda_smoke_topic) != ""
    error_message = "redpanda_smoke_topic must not be empty."
  }
}

variable "nats_smoke_subject" {
  description = "Dedicated smoke subject for NATS connectivity checks."
  type        = string

  validation {
    condition     = trimspace(var.nats_smoke_subject) != ""
    error_message = "nats_smoke_subject must not be empty."
  }
}
