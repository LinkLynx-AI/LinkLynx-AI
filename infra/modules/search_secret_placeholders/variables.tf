variable "environment" {
  description = "Environment name for labels."
  type        = string
}

variable "elastic_secret_ids" {
  description = "Secret Manager secret IDs reserved for Elastic Cloud connection material."
  type        = set(string)
  default     = []
}

variable "labels" {
  description = "Additional labels applied to secret placeholders."
  type        = map(string)
  default     = {}
}
