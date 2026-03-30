variable "environment" {
  description = "Environment name for labels."
  type        = string
}

variable "argocd_namespace" {
  description = "Namespace where Argo CD and Argo Rollouts are installed."
  type        = string
  default     = "ops"
}

variable "argocd_release_name" {
  description = "Helm release name for Argo CD."
  type        = string
  default     = "argocd"
}

variable "rollouts_release_name" {
  description = "Helm release name for Argo Rollouts."
  type        = string
  default     = "argo-rollouts"
}

variable "argocd_chart_version" {
  description = "Optional pinned Argo CD chart version."
  type        = string
  default     = ""
}

variable "rollouts_chart_version" {
  description = "Optional pinned Argo Rollouts chart version."
  type        = string
  default     = ""
}

variable "gitops_repository_url" {
  description = "Git repository URL watched by Argo CD applications."
  type        = string
}

variable "gitops_target_revision" {
  description = "Git revision watched by Argo CD applications."
  type        = string
}

variable "app_project_name" {
  description = "Argo CD AppProject name documented by the baseline."
  type        = string
}

variable "applications" {
  description = "Documented application layout managed by the baseline."
  type = map(object({
    destination_namespace = string
    path                  = string
    sync_policy = object({
      automated = bool
    })
  }))
}

variable "labels" {
  description = "Labels applied to Helm releases."
  type        = map(string)
  default     = {}
}
