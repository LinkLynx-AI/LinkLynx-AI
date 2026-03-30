variable "environment" {
  description = "Environment name."
  type        = string
}

variable "labels" {
  description = "Additional labels."
  type        = map(string)
  default     = {}
}

variable "hosts" {
  description = "ScyllaDB Cloud contact points for the environment."
  type        = set(string)

  validation {
    condition     = length(var.hosts) > 0
    error_message = "hosts must contain at least one Scylla contact point."
  }
}

variable "keyspace" {
  description = "Scylla keyspace used by LinkLynx."
  type        = string
  default     = "chat"
}

variable "schema_path" {
  description = "Expected runtime schema artifact path used for verification."
  type        = string
  default     = "/app/database/scylla/001_lin139_messages.cql"
}

variable "request_timeout_ms" {
  description = "Runtime request timeout used by the Scylla client."
  type        = number
  default     = 1000
}

variable "auth_enabled" {
  description = "Whether standard path requires credential-backed authentication."
  type        = bool
  default     = true
}

variable "tls_enabled" {
  description = "Whether standard path requires TLS for Scylla connectivity."
  type        = bool
  default     = true
}

variable "disallow_shard_aware_port" {
  description = "Whether the runtime should disable shard-aware ports by default."
  type        = bool
  default     = true
}

variable "secret_ids" {
  description = "Secret Manager secret IDs keyed by logical role."
  type        = map(string)

  validation {
    condition     = length(setsubtract(toset(["username", "password", "ca_bundle"]), toset(keys(var.secret_ids)))) == 0
    error_message = "secret_ids must contain username, password, and ca_bundle entries."
  }
}

variable "accessor_service_account_emails" {
  description = "Runtime GSA emails allowed to access the Scylla secrets."
  type        = set(string)

  validation {
    condition     = length(var.accessor_service_account_emails) > 0
    error_message = "accessor_service_account_emails must contain at least one runtime service account."
  }
}
