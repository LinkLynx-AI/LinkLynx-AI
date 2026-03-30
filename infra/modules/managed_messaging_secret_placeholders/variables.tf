variable "environment" {
  description = "Environment name for labels."
  type        = string
}

variable "redpanda_secret_ids" {
  description = "Secret Manager secret IDs reserved for Redpanda Cloud connection material."
  type        = set(string)
  default     = []
}

variable "nats_secret_ids" {
  description = "Secret Manager secret IDs reserved for NATS / Synadia connection material."
  type        = set(string)
  default     = []
}

variable "labels" {
  description = "Additional labels applied to secret placeholders."
  type        = map(string)
  default     = {}
}
