variable "project_id" {
  description = "GCP project ID."
  type        = string
}

variable "project_name" {
  description = "Human-readable GCP project name."
  type        = string
}

variable "billing_account_id" {
  description = "Plain billing account ID like 000000-000000-000000."
  type        = string

  validation {
    condition     = can(regex("^[0-9]{6}-[0-9]{6}-[0-9]{6}$", var.billing_account_id))
    error_message = "Billing account ID must be in format 000000-000000-000000."
  }
}

variable "folder_id" {
  description = "Parent folder ID. Set this or org_id."
  type        = string
  default     = ""
}

variable "org_id" {
  description = "Parent organization ID. Set this or folder_id."
  type        = string
  default     = ""
}

variable "auto_create_network" {
  description = "Whether to auto-create the default network."
  type        = bool
  default     = false
}

variable "services" {
  description = "Services to enable for the project."
  type        = list(string)
  default     = []
}

variable "labels" {
  description = "Project labels."
  type        = map(string)
  default     = {}
}

variable "budget_display_name" {
  description = "Display name for the billing budget."
  type        = string
}

variable "budget_amount" {
  description = "Monthly budget amount in whole units."
  type        = number
}

variable "budget_currency" {
  description = "Budget currency."
  type        = string
  default     = "JPY"
}

variable "budget_alert_thresholds" {
  description = "Budget alert thresholds expressed as 0-1 ratios."
  type        = list(number)
  default     = [0.5, 0.8, 1.0]

  validation {
    condition     = length(var.budget_alert_thresholds) > 0 && alltrue([for threshold in var.budget_alert_thresholds : threshold > 0 && threshold <= 1])
    error_message = "Budget alert thresholds must be ratios between 0 and 1."
  }
}

variable "budget_monitoring_notification_channels" {
  description = "Optional Cloud Monitoring notification channel resource names."
  type        = list(string)
  default     = []
}

variable "disable_default_budget_alert_recipients" {
  description = "Disable default Billing IAM email recipients for budget alerts."
  type        = bool
  default     = false
}
