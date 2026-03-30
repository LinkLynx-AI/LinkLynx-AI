variable "environment" {
  description = "Environment name."
  type        = string
}

variable "project_id" {
  description = "Project ID hosting the repository."
  type        = string
}

variable "location" {
  description = "Artifact Registry location."
  type        = string
}

variable "repository_id" {
  description = "Artifact Registry repository ID."
  type        = string
}

variable "service_names" {
  description = "Deploy target service names published into the repository."
  type        = set(string)
  default     = ["python", "rust", "typescript"]
}

variable "labels" {
  description = "Additional labels."
  type        = map(string)
  default     = {}
}
