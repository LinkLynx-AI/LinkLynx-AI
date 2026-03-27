locals {
  billing_budget_account_name = startswith(var.billing_account_id, "billingAccounts/") ? var.billing_account_id : "billingAccounts/${var.billing_account_id}"
}

resource "google_project" "this" {
  name                = var.project_name
  project_id          = var.project_id
  billing_account     = var.billing_account_id
  auto_create_network = var.auto_create_network
  org_id              = var.folder_id == "" ? var.org_id : null
  folder_id           = var.folder_id != "" ? var.folder_id : null
  labels              = var.labels
}

resource "google_project_service" "services" {
  for_each = toset(var.services)

  project            = google_project.this.project_id
  service            = each.value
  disable_on_destroy = false
}

resource "google_billing_budget" "this" {
  billing_account = local.billing_budget_account_name
  display_name    = var.budget_display_name

  budget_filter {
    projects = ["projects/${google_project.this.number}"]
  }

  amount {
    specified_amount {
      currency_code = var.budget_currency
      units         = tostring(var.budget_amount)
      nano          = 0
    }
  }

  all_updates_rule {
    monitoring_notification_channels = var.budget_monitoring_notification_channels
    disable_default_iam_recipients   = var.disable_default_budget_alert_recipients
  }

  dynamic "threshold_rules" {
    for_each = var.budget_alert_thresholds

    content {
      threshold_percent = threshold_rules.value
    }
  }

  depends_on = [google_project_service.services]
}
