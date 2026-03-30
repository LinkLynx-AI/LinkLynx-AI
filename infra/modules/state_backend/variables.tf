variable "project_id" {
  description = "Project that owns the state bucket."
  type        = string
}

variable "bucket_name" {
  description = "Globally unique bucket name."
  type        = string
}

variable "location" {
  description = "Bucket location."
  type        = string
}

variable "labels" {
  description = "Bucket labels."
  type        = map(string)
  default     = {}
}

variable "kms_key_name" {
  description = "Optional CMEK key for the bucket."
  type        = string
  default     = ""
}

variable "force_destroy" {
  description = "Allow destroying non-empty bucket."
  type        = bool
  default     = false
}
